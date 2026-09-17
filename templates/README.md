# BriefGate workflow templates

Three ready-to-import n8n workflows built on `n8n-nodes-briefgate`. Each is a plain workflow JSON export — no credentials or secrets inside (nodes reference a **BriefGate API** credential by name only; you create and attach your own on import) — and each carries an in-canvas sticky note explaining what it does and how to set it up.

Prerequisite for all three: install the community node first — self-hosted n8n → **Settings → Community Nodes** → install `n8n-nodes-briefgate` (it's submitted for n8n verification and not yet verified, so it isn't installable directly from n8n Cloud's Community Nodes panel yet — see [docs.briefgate.dev/docs/n8n](https://briefgate.dev/docs/n8n)).

Import any file below via n8n's **Import from File** (or paste its contents with **Import from URL / clipboard**).

These notes are written for submitting each workflow to n8n's [Creator Hub](https://creators.n8n.io/) template library — title, short/long description, required nodes and credentials, and setup steps, per what n8n's public docs and community guidance say submissions are checked for: everything in English, sticky notes documenting setup, and no mention of a node or tool that isn't actually in the workflow. (The Creator Hub's full checklist is behind creator login; this follows the parts documented publicly — see [Guideline notes](#guideline-notes) below.)

---

## 1. Start a BriefGate client intake when a new deal is won

File: [`1-start-intake-on-deal-won.json`](./1-start-intake-on-deal-won.json)

**Short description:** Turn a "deal won" webhook from your CRM into a BriefGate client intake, so the client gets asked for their logo, copy and access the moment a project starts — no one has to remember to send that email by hand.

**Long description:** Most agencies lose a day or two between a deal closing and someone actually asking the client for the logo, brand colors, and website copy the project needs. This workflow closes that gap automatically: a Webhook node receives a "deal won" event from your CRM (directly, or via Zapier/Make/a native webhook action — most CRMs support calling a URL on a stage change), and immediately calls BriefGate's **Create Intake** operation with the project name and client contact pulled from that event. BriefGate emails the client a portal link the same moment the deal closes. The three starter items (logo, brand colors, website copy) are a starting point — edit them on the BriefGate node to match what your team actually asks for.

**Nodes used:** Webhook (trigger), BriefGate (Create Intake).

**Credentials required:** BriefGate API (any scope that allows creating intakes — `intakes:write` or `admin`).

**Setup steps:**
1. Install `n8n-nodes-briefgate` and create a BriefGate API credential (API key from BriefGate dashboard → Settings → API keys; use a `bg_test_…` key while testing).
2. Attach that credential to the BriefGate node.
3. Activate the workflow, copy the Webhook node's Production URL, and point your CRM's "deal won" automation at it.
4. Edit the **Items** on the BriefGate node to the fields your team actually needs from a new client.
5. Adjust the field names read from the webhook body (`deal_name`, `client_email`, `client_name`) to match whatever your CRM/automation tool actually sends.

---

## 2. Save completed BriefGate intake files to Google Drive

File: [`2-save-completed-intake-files-to-drive.json`](./2-save-completed-intake-files-to-drive.json)

**Short description:** When a client finishes a BriefGate intake, automatically download every file they submitted and upload it straight into a Google Drive folder — no one has to open the dashboard and download a ZIP by hand.

**Long description:** BriefGate's `intake.completed` webhook fires once every required item on an intake has been submitted. This workflow listens for it with a **BriefGate Trigger** node, calls **Get Results** to read back the typed values, and runs a small Code node that picks out every item that is a file, image, or file list (each carries a signed, time-limited download URL). Each file is then downloaded with an HTTP Request node and uploaded to a Google Drive folder, named after its BriefGate item key. Point it at a per-client or per-project folder, and client assets land there without anyone touching the BriefGate dashboard.

**Nodes used:** BriefGate Trigger, BriefGate (Get Results), Code, HTTP Request, Google Drive.

**Credentials required:** BriefGate API (needs the **`admin`** scope on the BriefGate Trigger node specifically — registering a webhook subscribes to events across the whole account; `intakes:read` is enough on the Get Results node), Google Drive OAuth2.

**Setup steps:**
1. Install `n8n-nodes-briefgate` and create a BriefGate API credential with the `admin` scope.
2. Attach it to both BriefGate nodes (Trigger and Get Results).
3. Connect your Google Drive account on the Google Drive node and choose a destination folder.
4. Activate the workflow — this registers the BriefGate webhook automatically; deactivating removes it again.
5. BriefGate's file URLs are signed and expire after 24 hours, so this only works reacting to the live event, not replayed against an old execution.

---

## 3. AI agent that tells you which clients still owe materials

File: [`3-ai-agent-outstanding-materials.json`](./3-ai-agent-outstanding-materials.json)

**Short description:** Ask a chat-based AI agent "which clients still owe me materials?" and it checks your live BriefGate intakes and answers with exactly what's still missing, instead of you opening the dashboard.

**Long description:** This workflow wires BriefGate into an n8n AI Agent as a tool, the same way you'd give it a calendar or a CRM. A Chat Trigger starts the conversation; the AI Agent (backed by an OpenAI Chat Model, swappable for any n8n chat model node) has two BriefGate Tool nodes available: one that lists in-progress intakes, and one that reads a single intake's status, including which specific items are still pending or need revision. The agent decides on its own which tool calls it needs to answer your question, so "which clients still owe me materials?" and "what's the status of the Bella Napoli project?" both work from the same setup.

**Nodes used:** Chat Trigger, AI Agent, OpenAI Chat Model, BriefGate Tool (×2 — List Intakes, Get Intake Status).

**Credentials required:** BriefGate API (`intakes:read` is enough), OpenAI API (or credentials for whichever chat model node you swap in).

**Setup steps:**
1. Install `n8n-nodes-briefgate` and create a BriefGate API credential.
2. Attach it to both BriefGate Tool nodes.
3. Attach your OpenAI credential to the OpenAI Chat Model node (or replace it with another provider's chat model node — any of them plug into the same AI Agent).
4. Open the chat panel at the bottom of the canvas and ask a question.

---

## Guideline notes

Followed while building these three, based on what's publicly documented (n8n's Creator Hub keeps its full reviewer checklist behind creator login, so treat this as best-effort, not a guarantee of first-pass approval):

- **Everything user-facing is in English** — title, both descriptions, and every sticky note.
- **Only nodes actually present in the workflow are named** in the descriptions above (no promising an integration that isn't wired up).
- **A sticky note on every workflow** explains, in plain language: who it's for, what it does, and numbered setup steps — per n8n's own guidance that sticky notes should carry "who it's for + what it does + how it works + how to use," and per community reports that a missing setup sticky note is a common rejection reason.
- **No credentials or secrets are embedded.** Every credential reference is `{ "<type>": { "name": "<generic account name>" } }` — a name only, no `id`, so importing the template never points at someone else's live BriefGate/Google/OpenAI account. The importing user assigns their own credential.
- **Validated as real n8n workflow JSON**, not hand-waved: each file was imported via `n8n import:workflow` into a local n8n 2.39.6 instance with `n8n-nodes-briefgate` installed, confirmed to import without error, then removed again before committing.
