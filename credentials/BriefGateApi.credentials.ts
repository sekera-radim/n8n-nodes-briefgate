import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class BriefGateApi implements ICredentialType {
	name = 'briefGateApi';

	displayName = 'BriefGate API';

	documentationUrl = 'https://briefgate.dev/docs/rest-api?utm_source=n8n';

	icon = 'file:../nodes/BriefGate/briefgate.svg' as const;

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your BriefGate API key (starts with "bg_live_" or "bg_test_"). Create one in the BriefGate dashboard under API Keys, or use a "bg_test_" key while building this workflow — it never emails or texts real clients.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.briefgate.dev',
			description: 'Only change this for a self-hosted or staging BriefGate deployment.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/usage',
		},
	};
}
