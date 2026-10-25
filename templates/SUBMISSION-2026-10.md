# BriefGate n8n template gallery submissions

Two importable workflow templates built on the verified `n8n-nodes-briefgate`
community node (`BriefGate` + `BriefGate Trigger`), aimed at getting BriefGate
discoverable from inside the n8n template gallery. Nothing here was sent to
n8n or any account — these are local files for Radim to review, import, and
submit from his own n8n creator account.

## Template 1 — `save-intake-files-to-drive-and-notify-slack.json`

**Title:** Save completed BriefGate intake files to Drive and notify Slack

**Short description (gallery card):** When a BriefGate client intake is
completed, download every file/image the client submitted straight into a
Google Drive folder and post a Slack notification — no more remembering to
open the dashboard.

**Long description:**
Fires on the BriefGate `intake.completed` webhook event, reads back the
typed results via `BriefGate: Get Results`, then branches into two parallel
steps: (1) a Code node flattens file/image/file_list results into one item
per file, downloads each with an HTTP Request node, and uploads it to Google
Drive; (2) a Slack node posts a short "intake completed" message naming the
project. Built for agencies and freelancers who collect logos, photos and
other assets from clients through BriefGate and want them to land in the
project folder automatically.

**Category:** suggest "Document ops" / "File management" primary, "DevOps"
or "Marketing" secondary if the category picker allows more than one — final
choice depends on what the Creator Hub category list currently offers.

**Nodes used (BriefGate node, file:line in the node source):**
- `BriefGate Trigger` (`n8n-nodes-briefgate.briefGateTrigger`) — event
  `intake.completed`; registers a webhook (`admin` scope) —
  `/home/radim/gitlab/n8n-nodes-briefgate/nodes/BriefGateTrigger/BriefGateTrigger.node.ts:63-108`
- `BriefGate` node, operation `getResults`
  (`/home/radim/gitlab/n8n-nodes-briefgate/nodes/BriefGate/BriefGate.node.ts:366-389` for the
  parameter, `:579-588` for the API call)

**Built-in nodes:** `n8n-nodes-base.code` (flatten results), `n8n-nodes-base.httpRequest`
(download, `responseFormat: file`), `n8n-nodes-base.googleDrive` (upload),
`n8n-nodes-base.slack` (resource `message`, operation `post`).

## Template 2 — `start-tailored-intake-on-deal-won.json`

**Title:** Start a tailored BriefGate client intake when a deal is won

**Short description (gallery card):** When your CRM marks a deal as won,
automatically create a BriefGate client intake with the right item list for
what was actually sold — website, branding, or content — and email the
client their portal link.

**Long description:**
Receives a webhook from a CRM (or Zapier/Make/any system that can call a
URL) carrying `deal_name`, `client_email`, `client_name` and `deal_type`,
routes it through a Switch node on `deal_type`, and calls `BriefGate: Create
Intake` with a different item set per branch (website materials, branding
materials, content materials), falling back to a short general intake for
anything unrecognized. Built for agencies running several kinds of
engagements who don't want to ask every client for the same boilerplate
checklist.

**Why this shape, not the simpler version:** an earlier, single-branch
version of this idea ("deal won → one fixed intake") was already submitted
and rejected by n8n on 20. 9. 2026 as "too basic" for the template library,
with n8n suggesting more steps — branching, AI, or result processing — as
the bar for template-library quality (see project memory
`briefgate-n8n`). This version adds the branching n8n asked for instead of
resubmitting the rejected shape.

**Category:** suggest "Sales" or "CRM" primary (deal-won trigger), "Content
creation" secondary — confirm against the current category list.

**Nodes used (BriefGate node, file:line):**
- `BriefGate` node, operation `create`, four times (one per branch) —
  parameters at
  `/home/radim/gitlab/n8n-nodes-briefgate/nodes/BriefGate/BriefGate.node.ts:87-352`,
  execution at `:481-571`. Each branch uses `itemsMode: "fixed"` with 2-3
  items chosen from the node's real `itemTypeOptions`
  (`BriefGate.node.ts:12-25`): `image`, `color_list`, `longtext`, `file_list`,
  `text`.

**Built-in nodes:** `n8n-nodes-base.webhook` (POST, path `deal-won`),
`n8n-nodes-base.switch` (rules mode, 3 conditions + fallback output).

## Verification done

- Both files pass `python3 -I -m json.tool` (valid JSON) and a structural
  check (no duplicate node IDs/names, every connection source/target matches
  an existing node).
- **Import verified against real n8n**, not just by inspection: pulled
  `n8nio/n8n:latest` in Docker and ran
  `docker run --rm -v <dir>:/data:ro -v n8n-tpl-check:/home/node/.n8n n8nio/n8n:latest import:workflow --input=/data/<file>.json`
  for each file. Both printed `Successfully imported 1 workflow.` — n8n's own
  importer (which runs schema/entity validation on the workflow, not just
  "is it JSON") accepted both files as-is. The community node itself wasn't
  installed in that vanilla image, so this does **not** confirm the BriefGate
  node's parameters execute correctly end-to-end (only that the workflow
  structure, connections and node parameter shapes are well-formed) — that
  part is already covered by reading `BriefGate.node.ts` directly and mirroring
  the already-published sibling templates (`1-start-intake-on-deal-won.json`,
  `2-save-completed-intake-files-to-drive.json`,
  `3-ai-agent-outstanding-materials.json` in
  `/home/radim/gitlab/n8n-nodes-briefgate/templates/`), which use the exact
  same BriefGate node parameters and were already built against this node.
  Docker test volume and containers were cleaned up after the check (all
  containers ran with `--rm`; the `n8n-tpl-check` volume was removed).
- **Two node types could not be verified against a live n8n UI** and are
  flagged here per your instruction to use the minimum needed and say so:
  - `n8n-nodes-base.switch` (typeVersion 3.2, "rules" mode) — the
    `conditions`/`rightValue`/`fallbackOutput: "extra"` shape is written from
    memory of the current Filter/Switch condition format, not confirmed by
    opening the node UI. **Open this node after import and check the three
    conditions and the fallback output still make sense** before relying on
    it.
  - `n8n-nodes-base.slack` (typeVersion 2.2, resource `message`, operation
    `post`) — channel resource-locator defaults to `general`; confirm the
    channel picker resolves correctly for your workspace and pick the real
    target channel.

## Steps for Radim

1. Open each `.json` in a text editor or import it locally
   (**Workflows → Import from File**) to eyeball it once more, especially the
   two flagged nodes above.
2. Add real credentials (BriefGate API key — a `bg_test_…` one is enough to
   test without emailing a real client — plus Google Drive / Slack OAuth2)
   and run each workflow once manually to confirm it behaves as described.
3. Submit from your **n8n creator account** via the Creator Hub (the
   submission portal n8n linked in the "node approved" email) — not from
   this session, nothing here was sent anywhere.
4. For each template, the submission form will ask for: title and both
   descriptions above, category, and the workflow JSON — paste the content
   of the `.json` file.
5. If the submission form rejects the JSON with a 400 error, the most
   commonly reported cause on the n8n forum is a few top-level fields the
   portal doesn't expect (`id`, `active`, `meta`, `pinData`, `version`) —
   strip those four/five keys and resubmit the rest unchanged; it is **not**
   confirmed that community nodes themselves are rejected (the existing
   `1-start-intake-on-deal-won.json` template was rejected for being "too
   basic", not for its node types, which is why this round added branching
   and a second automated step instead of changing node types).
6. Watch for the same kind of rejection email as 20. 9. 2026
   (`creators@n8n.io`) — if either of these is rejected again, the reason
   given is useful signal for what the template bar actually requires next.

## Gallery/submission rules found (and what's unverified)

- Official guidance points to n8n's **Creator Hub** (a Notion page linked
  from the "node approved"/docs.n8n.io pages) as the authoritative source;
  it renders via JavaScript and couldn't be read by this session's fetch
  tool, so the rules below are reconstructed from forum threads, not the
  primary page — re-check the Creator Hub page yourself before submitting.
- **Sticky notes are expected practice**, not just nice-to-have — n8n's own
  rejection-feedback and forum guidance both point to a sticky note
  explaining setup; both templates here lead with one.
- Whether submissions using **verified community nodes are allowed**: not
  stated as a formal rule anywhere found, but there is direct first-party
  evidence either way it could go — n8n already verified and published
  `n8n-nodes-briefgate` itself (23. 9. 2026), and when it rejected
  `1-start-intake-on-deal-won.json` on 20. 9. 2026 it gave "too basic" as the
  reason, never objecting to the node type. That is the strongest signal
  available that community-node templates are accepted on merit, same as
  any other template.
- A community forum thread (400-error report) **speculates** community
  nodes might trigger a submission-portal rejection alongside SSH/Execute
  Command/local-file nodes, but the thread's own accepted fix was unrelated
  (malformed JSON), and this is explicitly unconfirmed — flagged above as a
  fallback if you do hit a 400.
