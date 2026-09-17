# n8n-nodes-briefgate

This is an n8n community node for [BriefGate](https://briefgate.dev?utm_source=n8n) — collect files, text, and credentials from clients through a portal, without giving them an account. It automates reminders, and hands you (or your agent) typed results when the client is done.

It contains two nodes:

- **BriefGate** — create intakes, check status, read results, send a reminder, list intakes.
- **BriefGate Trigger** — starts a workflow when a client submits an item or completes an intake (or three other events), by registering a BriefGate webhook for you.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

In n8n:

1. Go to **Settings → Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-briefgate`.
4. Agree to the risk notice and select **Install**.

Or, self-hosted with npm:

```bash
npm install n8n-nodes-briefgate
```

## Credentials

The node authenticates with a BriefGate **API key** (`bg_live_…` or `bg_test_…`):

1. In the BriefGate dashboard, go to **API Keys** and create a key. Use a `bg_test_…` key while building your workflow — it behaves normally but never emails or texts a real client.
2. In n8n, create a **BriefGate API** credential and paste the key in.
3. The **BriefGate Trigger** node additionally needs a key with the `admin` scope, since registering a webhook covers every event on the account — see [BriefGate's API key scopes](https://briefgate.dev/docs/rest-api?utm_source=n8n#authentication).

## Operations

### BriefGate node

| Operation | What it does |
|---|---|
| Create Intake | Starts a new intake and emails the client their portal link. Define items with fixed fields or raw JSON. |
| Get Status | Item statuses, chase history and progress for one intake. |
| Get Results | Typed values for approved (optionally also submitted-but-not-approved) items, with signed file URLs. |
| Send Reminder | Manually triggers a chase message (email or SMS) outside the automatic schedule. |
| List | Lists intakes, with status/client/folder/search filters and pagination. |

### BriefGate Trigger node

Fires your workflow when one of these BriefGate events happens:

- `intake.completed` — every required item has been submitted
- `item.submitted` — the client submitted or filled in one item
- `client.viewed` — the client opened their portal
- `chase.bounced` — a reminder hard-bounced or was reported as spam
- `intake.stalled` — the intake used up its reminder allowance
- `intake.overdue` — the due date passed with required items outstanding

Activating the workflow registers a webhook endpoint on your BriefGate account pointing at n8n's webhook URL; deactivating removes it. Every delivery is verified against BriefGate's `X-BriefGate-Signature` header (HMAC-SHA256, 5-minute replay window) before it reaches your workflow — see [BriefGate's webhook docs](https://briefgate.dev/docs/webhooks?utm_source=n8n).

## Example workflow

**New client, one click:** a form (Typeform/n8n form trigger) collects a project name and client email → **BriefGate: Create Intake** with the items your team always asks for → **BriefGate Trigger: `intake.completed`** fires when the client is done → **BriefGate: Get Results** → hand the results to your build pipeline, a Notion page, or an agent.

## Compatibility

Built and tested against n8n's community node API version 1 (`n8n-workflow` ^1.63). Requires Node.js >= 18.10.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [BriefGate REST API reference](https://briefgate.dev/docs/rest-api?utm_source=n8n)
- [BriefGate webhooks reference](https://briefgate.dev/docs/webhooks?utm_source=n8n)
- [briefgate.dev](https://briefgate.dev?utm_source=n8n)

## License

[MIT](LICENSE.md)
