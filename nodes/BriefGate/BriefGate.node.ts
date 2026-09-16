import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { briefGateApiRequest, parseJsonParameter } from '../GenericFunctions';

const itemTypeOptions = [
	{ name: 'Boolean', value: 'boolean' },
	{ name: 'Color List', value: 'color_list' },
	{ name: 'File', value: 'file' },
	{ name: 'File List', value: 'file_list' },
	{ name: 'Image', value: 'image' },
	{ name: 'Long Text', value: 'longtext' },
	{ name: 'Multiselect', value: 'multiselect' },
	{ name: 'Secret', value: 'secret' },
	{ name: 'Select', value: 'select' },
	{ name: 'Structured', value: 'structured' },
	{ name: 'Text', value: 'text' },
	{ name: 'URL', value: 'url' },
];

export class BriefGate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'BriefGate',
		name: 'briefGate',
		icon: 'file:briefgate.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Collect files, text and credentials from clients via BriefGate',
		defaults: { name: 'BriefGate' },
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'briefGateApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'create',
				options: [
					{
						name: 'Create Intake',
						value: 'create',
						description: 'Start a new intake and email the client their portal link',
						action: 'Create an intake',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List intakes with optional filters',
						action: 'List intakes',
					},
					{
						name: 'Get Results',
						value: 'getResults',
						description: 'Read typed values for approved (and optionally submitted) items',
						action: 'Get intake results',
					},
					{
						name: 'Get Status',
						value: 'getStatus',
						description: 'Read item statuses, chase history and progress for one intake',
						action: 'Get intake status',
					},
					{
						name: 'Send Reminder',
						value: 'sendReminder',
						description: 'Manually trigger a chase message outside the automatic schedule',
						action: 'Send a reminder',
					},
				],
			},

			// ── Create ──────────────────────────────────────────────────────────
			{
				displayName: 'Project Name',
				name: 'projectName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['create'] } },
				description: 'Human-readable project title, e.g. "Bella Napoli — Website"',
			},
			{
				displayName: 'Client Email',
				name: 'clientEmail',
				type: 'string',
				placeholder: 'name@example.com',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['create'] } },
				description: 'Where the portal link is sent',
			},
			{
				displayName: 'Client Name',
				name: 'clientName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['create'] } },
				description: 'Shown in the invitation — every email opens by addressing the client, so this cannot be blank',
			},
			{
				displayName: 'Specify Items',
				name: 'itemsMode',
				type: 'options',
				default: 'fixed',
				displayOptions: { show: { operation: ['create'] } },
				options: [
					{ name: 'Using Fields Below', value: 'fixed' },
					{ name: 'Using JSON', value: 'json' },
				],
				description: 'At least one item is required — what the client (or you) is asked to provide',
			},
			{
				displayName: 'Items',
				name: 'itemsFixedCollection',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, sortable: true },
				placeholder: 'Add Item',
				default: {},
				displayOptions: { show: { operation: ['create'], itemsMode: ['fixed'] } },
				options: [
					{
						name: 'item',
						displayName: 'Item',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
								required: true,
								description:
									'Stable identifier for this item, e.g. "logo". Results and webhooks reference items by key.',
							},
							{
								displayName: 'Label',
								name: 'label',
								type: 'string',
								default: '',
								required: true,
								description: 'What the client sees, e.g. "Restaurant logo"',
							},
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								options: itemTypeOptions,
								default: 'text',
							},
							{
								displayName: 'Required',
								name: 'required',
								type: 'boolean',
								default: true,
							},
							{
								displayName: 'Assignee',
								name: 'assignee',
								type: 'options',
								options: [
									{ name: 'Client', value: 'client' },
									{ name: 'Owner (Your Own Task)', value: 'owner' },
								],
								default: 'client',
							},
							{
								displayName: 'Help Text',
								name: 'help',
								type: 'string',
								default: '',
								description: 'Optional hint shown under the label in the portal',
							},
							{
								displayName: 'Advanced (JSON)',
								name: 'extraJson',
								type: 'json',
								default: '',
								description:
									'Optional, merged onto the item. Use for "constraints" (e.g. formats, min_width, max_chars, min_count/max_count), "options" (select/multiselect), "schema" (structured) or "pattern". Example: {"constraints": {"formats": ["png","svg"], "min_width": 512}}',
							},
						],
					},
				],
			},
			{
				displayName: 'Items (JSON)',
				name: 'itemsJson',
				type: 'json',
				default: '[\n  {\n    "key": "logo",\n    "label": "Company logo",\n    "type": "image",\n    "required": true\n  }\n]',
				displayOptions: { show: { operation: ['create'], itemsMode: ['json'] } },
				description: 'Array of item definitions, same shape as the BriefGate REST API — see docs.briefgate.dev',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { operation: ['create'] } },
				options: [
					{
						displayName: 'Also Notify (JSON)',
						name: 'also_notify',
						type: 'json',
						default: '',
						description:
							'Up to 4 more recipients who get the same portal link and reminders, e.g. [{"email": "chef@example.com", "name": "Giulia"}]',
					},
					{
						displayName: 'Client Brief',
						name: 'client_brief',
						type: 'string',
						typeOptions: { rows: 3 },
						default: '',
						description: 'Information and context for the client, shown at the top of the portal (max 5000 characters)',
					},
					{
						displayName: 'Client Language',
						name: 'client_language',
						type: 'options',
						options: [
							{ name: 'Czech', value: 'cs' },
							{ name: 'English', value: 'en' },
							{ name: 'German', value: 'de' },
							{ name: 'Polish', value: 'pl' },
							{ name: 'Slovak', value: 'sk' },
							{ name: 'Spanish', value: 'es' },
						],
						default: 'en',
					},
					{
						displayName: 'Client Phone',
						name: 'client_phone',
						type: 'string',
						default: '',
						description: 'E.164 format, e.g. +420601123456. Used for SMS reminders.',
					},
					{
						displayName: 'Client Timezone',
						name: 'client_timezone',
						type: 'string',
						default: '',
						placeholder: 'Europe/Prague',
						description: 'IANA timezone. Anchors quiet hours and reminder time to the client\'s local clock.',
					},
					{
						displayName: 'Due Date',
						name: 'due_date',
						type: 'string',
						default: '',
						placeholder: '2026-12-01',
						description: 'ISO 8601 date shown to the client',
					},
					{
						displayName: 'Folder Name or ID',
						name: 'folder_id',
						type: 'string',
						default: '',
						description: 'ID of an existing folder from the BriefGate dashboard. Leave empty for Unfiled.',
					},
					{
						displayName: 'Chase At Time',
						name: 'chase_at_time',
						type: 'string',
						default: '',
						placeholder: '09:00',
						description: 'Local time of day (HH:MM) for the reminder. Requires Custom schedule with a whole-day interval.',
					},
					{
						displayName: 'Chase Interval',
						name: 'chase_interval',
						type: 'number',
						default: 3,
						description: 'Only used with Chase Schedule = Custom',
					},
					{
						displayName: 'Chase Interval Unit',
						name: 'chase_interval_unit',
						type: 'options',
						options: [
							{ name: 'Minutes', value: 'minutes' },
							{ name: 'Hours', value: 'hours' },
							{ name: 'Days', value: 'days' },
						],
						default: 'days',
					},
					{
						displayName: 'Chase Schedule',
						name: 'chase_schedule',
						type: 'options',
						options: [
							{ name: 'Aggressive (T+1, T+3, T+5 Days, Then Every Other Day)', value: 'aggressive' },
							{ name: 'Custom', value: 'custom' },
							{ name: 'Default (T+2, T+5, T+9 Days, Then Weekly)', value: 'default' },
							{ name: 'Gentle (T+3, T+8 Days, Then Biweekly)', value: 'gentle' },
							{ name: 'Off (No Automatic Reminders)', value: 'off' },
						],
						default: 'default',
					},
					{
						displayName: 'Idempotency Key',
						name: 'idempotencyKey',
						type: 'string',
						default: '',
						description: 'Unique string (UUID recommended). Re-using it returns the original intake instead of creating a duplicate.',
					},
					{
						displayName: 'Max Reminders',
						name: 'max_reminders',
						type: 'string',
						default: '',
						placeholder: '3',
						description: 'Number of reminders before the intake is marked stalled (1-1000), or "unlimited"',
					},
					{
						displayName: 'Respect Quiet Hours',
						name: 'respect_quiet_hours',
						type: 'boolean',
						default: true,
						description: 'Whether to hold reminders to the client\'s 08:00-19:00 local window',
					},
					{
						displayName: 'Send Immediately',
						name: 'send',
						type: 'boolean',
						default: true,
						description: 'Whether to email the client right away. Set to false to create a draft and send later.',
					},
					{
						displayName: 'Template Slug',
						name: 'template',
						type: 'string',
						default: '',
						description: 'Slug of a saved BriefGate template. Items are still required even when a template is set.',
					},
				],
			},

			// ── Intake ID (getStatus / getResults / sendReminder) ─────────────────
			{
				displayName: 'Intake ID',
				name: 'intakeId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['getStatus', 'getResults', 'sendReminder'] } },
				description: 'ID of the intake, e.g. in_8f3kQmR2',
			},

			// ── Get Results ─────────────────────────────────────────────────────
			{
				displayName: 'Options',
				name: 'getResultsOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { operation: ['getResults'] } },
				options: [
					{
						displayName: 'Only New',
						name: 'only_new',
						type: 'boolean',
						default: false,
						description: 'Whether to only return items approved since the last call to this endpoint with this API key',
					},
					{
						displayName: 'Include Pending',
						name: 'include_pending',
						type: 'boolean',
						default: false,
						description: 'Whether to also include items that were submitted but not yet approved',
					},
				],
			},

			// ── Send Reminder ───────────────────────────────────────────────────
			{
				displayName: 'Channel',
				name: 'channel',
				type: 'options',
				default: 'email',
				displayOptions: { show: { operation: ['sendReminder'] } },
				options: [
					{ name: 'Email', value: 'email' },
					{ name: 'SMS', value: 'sms' },
				],
				description: 'SMS requires the "sms" feature and a positive SMS credit balance',
			},

			// ── List ────────────────────────────────────────────────────────────
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['getAll'] } },
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 50,
				displayOptions: { show: { operation: ['getAll'], returnAll: [false] } },
				description: 'Max number of results to return',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { operation: ['getAll'] } },
				options: [
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						default: '',
						options: [
							{ name: 'Any', value: '' },
							{ name: 'Archived', value: 'archived' },
							{ name: 'Completed', value: 'completed' },
							{ name: 'Draft', value: 'draft' },
							{ name: 'In Progress', value: 'in_progress' },
							{ name: 'Sent', value: 'sent' },
						],
					},
					{
						displayName: 'Client Email',
						name: 'client_email',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Folder ID',
						name: 'folder_id',
						type: 'string',
						default: '',
						description: 'Use the literal "none" to find intakes with no folder',
					},
					{
						displayName: 'Search (Project / Client)',
						name: 'q',
						type: 'string',
						default: '',
						description: 'Case-insensitive substring search across project name, client name and client email',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: IDataObject | IDataObject[] = {};

				if (operation === 'create') {
					const projectName = this.getNodeParameter('projectName', i) as string;
					const clientEmail = this.getNodeParameter('clientEmail', i) as string;
					const clientName = this.getNodeParameter('clientName', i) as string;
					const itemsMode = this.getNodeParameter('itemsMode', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

					let itemDefinitions: IDataObject[];
					if (itemsMode === 'json') {
						const raw = this.getNodeParameter('itemsJson', i) as string;
						const parsed = parseJsonParameter.call(this, raw, i, 'Items (JSON)');
						itemDefinitions = (Array.isArray(parsed) ? parsed : []) as IDataObject[];
					} else {
						const fixed = this.getNodeParameter('itemsFixedCollection', i, {}) as {
							item?: IDataObject[];
						};
						itemDefinitions = (fixed.item ?? []).map((entry) => {
							const { extraJson, ...rest } = entry;
							const extra = extraJson
								? parseJsonParameter.call(this, extraJson as string, i, 'Items → Advanced (JSON)')
								: {};
							return { ...rest, ...extra };
						});
					}

					if (itemDefinitions.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'At least one item is required to create an intake',
							{ itemIndex: i },
						);
					}

					const body: IDataObject = {
						project_name: projectName,
						client: {
							email: clientEmail,
							name: clientName,
							...(additionalFields.client_language && {
								language: additionalFields.client_language,
							}),
							...(additionalFields.client_phone && { phone: additionalFields.client_phone }),
							...(additionalFields.client_timezone && {
								timezone: additionalFields.client_timezone,
							}),
						},
						items: itemDefinitions,
					};

					if (additionalFields.also_notify) {
						body.client = {
							...(body.client as IDataObject),
							also_notify: parseJsonParameter.call(
								this,
								additionalFields.also_notify as string,
								i,
								'Also Notify (JSON)',
							),
						};
					}
					for (const field of [
						'client_brief',
						'chase_schedule',
						'chase_interval',
						'chase_interval_unit',
						'chase_at_time',
						'due_date',
						'folder_id',
						'max_reminders',
						'respect_quiet_hours',
						'send',
						'template',
					]) {
						if (additionalFields[field] !== undefined && additionalFields[field] !== '') {
							body[field] = additionalFields[field];
						}
					}

					const extraHeaders: IDataObject = {};
					if (additionalFields.idempotencyKey) {
						extraHeaders['Idempotency-Key'] = additionalFields.idempotencyKey;
					}

					responseData = (await briefGateApiRequest.call(
						this,
						'POST',
						'/intakes',
						body,
						{},
						extraHeaders,
					)) as IDataObject;
				} else if (operation === 'getStatus') {
					const intakeId = this.getNodeParameter('intakeId', i) as string;
					responseData = (await briefGateApiRequest.call(
						this,
						'GET',
						`/intakes/${intakeId}/status`,
					)) as IDataObject;
				} else if (operation === 'getResults') {
					const intakeId = this.getNodeParameter('intakeId', i) as string;
					const options = this.getNodeParameter('getResultsOptions', i, {}) as IDataObject;
					responseData = (await briefGateApiRequest.call(
						this,
						'GET',
						`/intakes/${intakeId}/results`,
						{},
						options,
					)) as IDataObject;
				} else if (operation === 'sendReminder') {
					const intakeId = this.getNodeParameter('intakeId', i) as string;
					const channel = this.getNodeParameter('channel', i) as string;
					responseData = (await briefGateApiRequest.call(
						this,
						'POST',
						`/intakes/${intakeId}/chase`,
						{ channel },
					)) as IDataObject;
				} else if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
					const qs: IDataObject = {};
					for (const key of ['status', 'client_email', 'folder_id', 'q']) {
						if (filters[key]) qs[key] = filters[key];
					}

					if (!returnAll) {
						qs.limit = this.getNodeParameter('limit', i) as number;
						const page = (await briefGateApiRequest.call(
							this,
							'GET',
							'/intakes',
							{},
							qs,
						)) as IDataObject;
						responseData = (page.intakes as IDataObject[]) ?? [];
					} else {
						const collected: IDataObject[] = [];
						const pageSize = 100;
						let offset = 0;
						for (;;) {
							const page = (await briefGateApiRequest.call(this, 'GET', '/intakes', {}, {
								...qs,
								limit: pageSize,
								offset,
							})) as IDataObject;
							const pageItems = (page.intakes as IDataObject[]) ?? [];
							collected.push(...pageItems);
							if (pageItems.length < pageSize) break;
							offset += pageSize;
						}
						responseData = collected;
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, {
						itemIndex: i,
					});
				}

				const resultItems = Array.isArray(responseData) ? responseData : [responseData];
				for (const resultItem of resultItems) {
					returnData.push({ json: resultItem, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
