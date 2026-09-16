import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

/**
 * Thin wrapper around n8n's authenticated HTTP helper for every BriefGate REST
 * call. Authentication itself lives in the credential's `authenticate` block
 * (BriefGateApi.credentials.ts) — this only builds the URL/body/qs and maps a
 * failed request onto a NodeApiError so it surfaces nicely in the editor.
 */
export async function briefGateApiRequest(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	extraHeaders?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('briefGateApi');
	const baseUrl = ((credentials.baseUrl as string) || 'https://api.briefgate.dev').replace(
		/\/+$/,
		'',
	);

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}/v1${endpoint}`,
		json: true,
	};

	if (Object.keys(body).length > 0) {
		options.body = body;
	}
	if (Object.keys(qs).length > 0) {
		options.qs = qs;
	}
	if (extraHeaders && Object.keys(extraHeaders).length > 0) {
		options.headers = extraHeaders as Record<string, string>;
	}

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'briefGateApi',
			options,
		);
		return response as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/** Parses a free-form JSON textarea parameter, wrapping bad JSON in a clear node error. */
export function parseJsonParameter(
	this: IExecuteFunctions,
	raw: string,
	itemIndex: number,
	fieldLabel: string,
): IDataObject {
	if (!raw || raw.trim() === '') return {};
	try {
		return JSON.parse(raw) as IDataObject;
	} catch (error) {
		throw new NodeApiError(
			this.getNode(),
			{ message: `${fieldLabel} is not valid JSON: ${(error as Error).message}` } as JsonObject,
			{ itemIndex },
		);
	}
}
