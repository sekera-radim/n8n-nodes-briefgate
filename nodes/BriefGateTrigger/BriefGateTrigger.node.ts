import { createHmac, timingSafeEqual } from 'crypto';

import type {
	IDataObject,
	IHookFunctions,
	IWebhookFunctions,
	IWebhookResponseData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { briefGateApiRequest } from '../GenericFunctions';

// The signature-tolerance window BriefGate documents (docs/webhooks.md):
// requests older than this are rejected as a possible replay.
const SIGNATURE_TOLERANCE_SECONDS = 300;

// Per docs/rest-api.md "These six are the only accepted values; anything else
// is rejected when you register the endpoint." (docs/webhooks.md additionally
// documents a 7th, `intake.archived` — flagged to BriefGate as a docs
// mismatch; left out here so registration never fails against the API as
// currently documented/enforced.)
const eventOptions = [
	{ name: 'Intake Completed', value: 'intake.completed' },
	{ name: 'Item Submitted', value: 'item.submitted' },
	{ name: 'Client Viewed Portal', value: 'client.viewed' },
	{ name: 'Chase Bounced', value: 'chase.bounced' },
	{ name: 'Intake Stalled', value: 'intake.stalled' },
	{ name: 'Intake Overdue', value: 'intake.overdue' },
];

function parseSignatureHeader(header: string): { t?: string; v1?: string } {
	const parts: Record<string, string> = {};
	for (const piece of header.split(',')) {
		const [key, value] = piece.split('=', 2);
		if (key && value) parts[key.trim()] = value.trim();
	}
	return { t: parts.t, v1: parts.v1 };
}

/**
 * Verifies BriefGate's `X-BriefGate-Signature: t=<unix>,v1=<hex>` header per
 * docs/webhooks.md — HMAC-SHA256(secret, `${t}.${rawBody}`), timing-safe
 * compare, and a 5-minute replay window.
 */
function verifySignature(signatureHeader: string, secret: string, rawBody: string): boolean {
	const { t, v1 } = parseSignatureHeader(signatureHeader);
	if (!t || !v1) return false;

	if (Math.abs(Date.now() / 1000 - Number(t)) > SIGNATURE_TOLERANCE_SECONDS) return false;

	const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');

	const expectedBuffer = Buffer.from(expected, 'hex');
	const actualBuffer = Buffer.from(v1, 'hex');
	if (expectedBuffer.length !== actualBuffer.length) return false;

	return timingSafeEqual(expectedBuffer, actualBuffer);
}

export class BriefGateTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'BriefGate Trigger',
		name: 'briefGateTrigger',
		icon: 'file:briefgate.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description:
			'Starts the workflow when a BriefGate intake event happens, e.g. a client submits an item or completes an intake',
		defaults: { name: 'BriefGate Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'briefGateApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'Registering this trigger creates a webhook endpoint on your BriefGate account (needs an API key with the "admin" scope). Activating the workflow registers it; deactivating removes it.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: eventOptions,
				default: ['intake.completed', 'item.submitted'],
				required: true,
				description: 'Which BriefGate events should trigger this workflow',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId === undefined) return false;

				try {
					const response = (await briefGateApiRequest.call(this, 'GET', '/webhooks')) as {
						webhooks: Array<{ id: string }>;
					};
					return response.webhooks.some((endpoint) => endpoint.id === webhookData.webhookId);
				} catch {
					// If BriefGate can't be reached to confirm, assume it's gone so n8n re-creates it.
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events', []) as string[];

				if (events.length === 0) {
					throw new NodeOperationError(this.getNode(), 'Select at least one event to subscribe to');
				}

				const responseData = (await briefGateApiRequest.call(this, 'POST', '/webhooks', {
					url: webhookUrl,
					events,
				})) as { id?: string; secret?: string };

				if (!responseData.id || !responseData.secret) {
					throw new NodeOperationError(
						this.getNode(),
						'BriefGate did not return a webhook ID and signing secret',
					);
				}

				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = responseData.id;
				webhookData.webhookSecret = responseData.secret;

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId === undefined) return true;

				try {
					await briefGateApiRequest.call(this, 'DELETE', `/webhooks/${webhookData.webhookId}`);
				} catch {
					// Endpoint may already be gone (e.g. removed from the dashboard) — don't
					// block deactivation on it, just forget our local reference below.
				}

				delete webhookData.webhookId;
				delete webhookData.webhookSecret;

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const headerData = this.getHeaderData() as IDataObject;
		const webhookData = this.getWorkflowStaticData('node');
		const secret = webhookData.webhookSecret as string | undefined;
		const res = this.getResponseObject();

		const signatureHeader = (headerData['x-briefgate-signature'] as string) ?? '';

		// n8n's webhook layer stores the exact bytes it received on `req.rawBody`
		// before JSON-parsing `req.body` — required here because the signature is
		// computed over the raw body string, not a re-serialized object.
		const rawBody = ((req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(
			JSON.stringify(req.body),
		)).toString('utf8');

		if (!secret || !verifySignature(signatureHeader, secret, rawBody)) {
			res.status(400).json({ message: 'Invalid or missing BriefGate webhook signature' });
			return { noWebhookResponse: true };
		}

		return {
			workflowData: [this.helpers.returnJsonArray(req.body as IDataObject)],
		};
	}
}
