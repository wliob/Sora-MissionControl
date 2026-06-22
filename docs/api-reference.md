# Sora-MissionControl Phase 4 API Reference

Status: Phase 4 verified transport cleanup. No secret values stored here.
Last verified: 2026-06-19 local runtime on Hermes host.

## Verification sources

- Runtime: `http://localhost:9119/` dashboard responded 200.
- Runtime: `GET http://localhost:9119/api/plugins/kanban/board` without auth returned `401 {"detail":"Unauthorized"}`.
- Runtime: dashboard HTML injects `window.__HERMES_SESSION_TOKEN__`; using that token as `X-Hermes-Session-Token: <token>` header returned 200 from `/api/plugins/kanban/board`.
- Runtime: `GET http://localhost:9119/api/plugins/kanban/profiles` with `X-Hermes-Session-Token` header returned 200 with profile roster (shape + sample data documented below). Endpoint was slow (>10s TTFB on this host); use ≥15s timeout.
- Runtime: `GET http://localhost:9119/api/plugins/chat/health` without auth returned 401 (auth middleware runs before routing); with a valid `X-Hermes-Session-Token` header it returned 404 `{"detail":"No such API endpoint: /api/plugins/chat/health"}`. Same 404-with-auth for `/api/plugins/chat/events` and all other `/api/plugins/chat/*` paths — no chat plugin is mounted.
- Runtime: both `X-Hermes-Session-Token: <token>` and `Authorization: Bearer <token>` with the live session token returned 200 from `/api/plugins/kanban/board`; a fake token under either header returned 401. The canonical header is `X-Hermes-Session-Token`.
- Source: `hermes_cli/web_server.py` — `_SESSION_HEADER_NAME = "X-Hermes-Session-Token"` (line 190), `_has_valid_session_token` (line 234) accepts the canonical header then falls back to the legacy `Authorization: Bearer` path (lines 249-251), `/api/pty` PTY WebSocket bridge (line 10215).
- Source: `hermes_cli/pty_bridge.py` — POSIX PTY bridge spawned by `/api/pty`; the dashboard chat tab renders its bytes via xterm.js (`web/src/pages/ChatPage.tsx`).
- Source: `/home/wliob/.hermes/hermes-agent/plugins/kanban/dashboard/plugin_api.py` documents token-protected plugin routes and defines endpoints.
- Docs: `/home/wliob/.hermes/hermes-agent/website/docs/user-guide/features/kanban.md` lists the plugin API surface. Note: older docs text saying plugin routes are unauthenticated is stale for this runtime; source + runtime show auth required.

## Auth model

Dashboard HTTP APIs require the dashboard session token or session cookie.

- Browser source: dashboard HTML exposes `window.__HERMES_SESSION_TOKEN__` for in-dashboard pages.
- REST transport (canonical): `X-Hermes-Session-Token: <token>` header (verified Phase 4 — source: `hermes_cli/web_server.py:190` `_SESSION_HEADER_NAME`, validated by `_has_valid_session_token` at line 234).
- REST transport (legacy): `Authorization: Bearer <token>` header is still accepted for backward compatibility with older dashboard bundles (`web_server.py:249-251`). MissionControl should emit the canonical `X-Hermes-Session-Token` header; do not rely on the Bearer path.
- WS transport: plugin source requires token/ticket/internal auth via query, e.g. `/api/plugins/kanban/events?token=<session-token>` in legacy token mode. The PTY chat bridge `/api/pty` likewise uses `?token=<session-token>` (browsers cannot set headers on the WS upgrade).
- Runtime verification (2026-06-19, loopback mode): both `X-Hermes-Session-Token` and `Authorization: Bearer` with the live session token returned 200 from `/api/plugins/kanban/board`; a fake token under either header returned 401. The canonical header remains `X-Hermes-Session-Token`.
- Never expose token values in UI, logs, docs, or persisted config.

## Kanban dashboard API

Base path: `/api/plugins/kanban`
Auth: dashboard session bearer token/cookie for HTTP; query token/ticket/internal auth for WS.

### Runtime-verified board snapshot

`GET /api/plugins/kanban/board`

Observed response shape:

```ts
interface KanbanBoardResponse {
  assignees: string[];
  columns: Array<{ name: KanbanStatus; tasks: KanbanTaskCard[] }>;
  latest_event_id: number | null;
  now: number;
  tenants: string[];
}

type KanbanStatus =
  | 'triage'
  | 'todo'
  | 'scheduled'
  | 'ready'
  | 'running'
  | 'blocked'
  | 'review'
  | 'done';
```

Observed columns on local runtime:

```text
triage, todo, scheduled, ready, running, blocked, review, done
```

Observed task card keys include:

```text
id, title, body, assignee, status, priority, created_by, created_at,
started_at, completed_at, workspace_kind, workspace_path, claim_lock,
claim_expires, tenant, branch_name, result, idempotency_key,
consecutive_failures, worker_pid, last_failure_error, max_runtime_seconds,
last_heartbeat_at, current_run_id, workflow_template_id, current_step_key,
skills, model_override, max_retries, goal_mode, goal_max_turns, session_id,
age, latest_summary, link_counts, comment_count, progress, diagnostics,
warnings
```

### Source-verified routes

Defined in `plugins/kanban/dashboard/plugin_api.py`:

| Method | Path | Purpose | MissionControl owner |
|---|---|---|---|
| GET | `/board` | Board grouped by status plus tenants/assignees | Cloud adapter -> shared store |
| GET | `/tasks/{task_id}` | Task details, comments, events, links/runs | Cloud adapter, Biscuit drawer UI |
| POST | `/tasks` | Create task | Cloud adapter |
| PATCH | `/tasks/{task_id}` | Status, assignee, priority, title, body, result | Cloud adapter |
| DELETE | `/tasks/{task_id}` | Delete task | Cloud adapter; destructive confirm required |
| POST | `/tasks/bulk` | Bulk status/archive/reassign/priority | Cloud adapter; destructive confirm required |
| POST | `/tasks/{task_id}/comments` | Append comment | Cloud adapter |
| POST | `/links` | Add dependency | Cloud adapter |
| DELETE | `/links` | Remove dependency | Cloud adapter |
| GET | `/diagnostics` | Board health diagnostics | Cloud ops/admin |
| GET | `/workers/active` | Active workers | Cloud ops |
| GET | `/runs/{run_id}` | Run detail | Cloud ops |
| GET | `/runs/{run_id}/inspect` | Inspect run artifacts | Cloud ops |
| POST | `/runs/{run_id}/terminate` | Terminate run | Cloud admin; high-risk confirm |
| POST | `/tasks/{task_id}/reclaim` | Reclaim active claim | Cloud admin; confirm |
| POST | `/tasks/{task_id}/specify` | Triage specifier | Cloud adapter; optional |
| POST | `/tasks/{task_id}/reassign` | Reassign task | Cloud adapter |
| GET | `/config` | Dashboard kanban prefs | Cloud adapter |
| GET | `/home-channels` | Home destinations | Cloud adapter |
| POST | `/tasks/{task_id}/home-subscribe/{platform}` | Subscribe task notifications | Cloud adapter |
| DELETE | `/tasks/{task_id}/home-subscribe/{platform}` | Unsubscribe task notifications | Cloud adapter |
| GET | `/stats` | Board stats | Cloud ops |
| GET | `/assignees` | Assignee list | Cloud adapter |
| GET | `/tasks/{task_id}/log` | Task log | Cloud ops |
| POST | `/dispatch` | Nudge dispatcher | Cloud admin; confirm/dry-run first |
| GET | `/boards` | List boards | Cloud adapter |
| POST | `/boards` | Create board | Cloud admin |
| PATCH | `/boards/{slug}` | Rename board | Cloud admin |
| DELETE | `/boards/{slug}` | Archive/hard-delete board | Cloud admin; destructive confirm |
| POST | `/boards/{slug}/switch` | Switch active board | Cloud admin |
| GET | `/profiles` | Profile roster and descriptions | Cloud adapter |
| PATCH | `/profiles/{profile_name}` | Set/clear description | Cloud admin |
| POST | `/profiles/{profile_name}/describe-auto` | Generate description | Cloud admin; LLM cost warning |
| POST | `/tasks/{task_id}/decompose` | Decompose triage task | Cloud admin; LLM cost warning |
| GET | `/orchestration` | Orchestration settings | Cloud admin |
| WS | `/events` | Live task event stream | Cloud adapter -> shared event bus |

## Chat API — Phase 4 verified findings

No chat REST or WebSocket endpoint exists under `/api/plugins/chat/*`. All
paths there return 404 because no chat plugin is mounted. The dashboard's
chat surface is a PTY-over-WebSocket bridge at `/api/pty` (source:
`hermes_cli/web_server.py:10215`, `hermes_cli/pty_bridge.py`), not a REST/WS
chat API. That bridge spawns the real `hermes --tui` behind a POSIX PTY and
forwards bytes to xterm.js in the dashboard SPA.

| Path tested | Result | Implication |
|---|---|---|
| `GET /api/plugins/chat/health` | 404 (with valid session token) | No chat health check |
| `GET /api/plugins/chat/events` | 404 (with valid session token) | No chat WebSocket endpoint |
| `GET /api/plugins/chat/*` (any) | 404 (with valid session token) | No chat plugin mounted at all |
| `WS /api/pty?token=<session-token>` | 200 upgrade | PTY bridge — spawns `hermes --tui`; SPA-only, xterm.js front end |

Note: without a session token, `/api/plugins/chat/*` returns 401 (the auth
middleware runs before routing). With a valid `X-Hermes-Session-Token` header
the responses are 404 `{"detail":"No such API endpoint: ..."}` — confirming the
chat plugin is genuinely absent, not merely hidden behind auth.

Chat messaging in the Hermes dashboard goes through the embedded `/api/pty`
PTY WebSocket bridge, which is only accessible inside the dashboard SPA (it
speaks the PTY byte protocol, not a chat-message protocol). External browser
apps cannot use it directly. The MissionControl repo contains a prototype
`hermesChatProxy.js`, but it is not currently the active browser chat
transport. The verified Hermes surfaces are `hermes_cli/pty_bridge.py` (PTY
bridge), `hermes_cli/web_server.py` `/api/pty` endpoint, and the dashboard
`web/src/pages/ChatPage.tsx` (xterm.js front end). Until Cloud hardens and
injects a local CLI proxy (a thin REST/WS wrapper around `hermes chat -q <prompt>`
or the PTY bridge) or the dashboard exposes a direct chat REST/WS surface,
`HermesChatTransport` reports unavailability via `isAvailable() → false` and
`sendMessage`/`subscribe` throw clear errors. The `chatBackbone` falls back to
the demo mock transport.

## Profile endpoint — runtime-verified shape

`GET /api/plugins/kanban/profiles`
Auth: `X-Hermes-Session-Token` header required (legacy `Authorization: Bearer` also accepted).

Observed response shape:

```ts
interface RawKanbanProfile {
  name: string;           // profile name, used as AgentId
  is_default: boolean;
  model: string;          // e.g. 'deepseek-v4-pro'
  provider: string;       // e.g. 'opencode-go'
  description: string;    // human-readable role; may be empty
  description_auto: boolean;
  skill_count: number;    // number of installed skills
}

interface RawKanbanProfilesResponse {
  profiles: RawKanbanProfile[];
}
```

Runtime-verified roster (2026-06-19, loopback, `X-Hermes-Session-Token` header):

| name | is_default | model | provider | skill_count | description (truncated) |
|---|---|---|---|---|---|
| default | true | gpt-5.4-mini | openai-codex | 164 | (empty) |
| biscuit | false | glm-5.2 | ollama-cloud | 108 | Automation & Coding … |
| cloud | false | deepseek-v4-pro | opencode-go | 102 | Systems & Infrastructure … |
| korra | false | gpt-5.5 | openai-codex | 106 | Creative & Media … |
| lelouch | false | gpt-5.4-mini | openai-codex | 103 | Lifestyle & Logistics … |
| rain | false | gpt-5.4-mini | openai-codex | 13 | Social media lead … |
| tifa | false | gpt-5.5 | openai-codex | (see runtime) | (see runtime) |

Note: the profiles endpoint can be slow (observed >10s time-to-first-byte on
this host); clients should use a generous timeout (≥15s) and not treat a
short timeout as an empty roster.

The `HermesChatTransport.listProfiles()` method maps this into the
`ProfileSummary` shape (`id`/`name`/`role`), using `description` as `role`
with a fallback to `name` when the description is empty.

## CLI surfaces verified

These are local-host control surfaces. MissionControl may call them through a trusted local proxy only; browser UI must not spawn CLI directly.

| Surface | Verified command | Notes |
|---|---|---|
| Profiles | `hermes profile list`, `hermes profile show <name>` | Runtime output showed default, cloud, biscuit, korra, lelouch, rain, tifa; gateway/model/status visible. |
| Chat | `hermes chat -q <prompt>` and `hermes --profile <name> chat -q <prompt>` | Works for CLI routing. Direct HTTP chat transport still unverified. |
| Usage | `hermes insights --days N --source <source>` | Historical token/cost/tool usage. Real-time provider quota remains gap. |
| Model selection | `hermes model` | Interactive. For automation, prefer explicit config/proxy endpoint after Cloud verifies safe flow. |
| Cron | `hermes cron list/create/edit/pause/resume/run/remove/status/tick` | CLI verified; tool `cronjob` also available to agents. |
| Webhooks | `hermes webhook subscribe/list/remove/test` | Runtime list showed test-webhook, sora-inbox, dexcom-alert. |
| Credentials | `hermes auth add/list/remove/reset/status/logout`; `hermes secrets` command exists | UI must show configured/missing status only, never values. |
| Skills | `hermes skills browse/search/install/inspect/list/check/update/audit/uninstall/reset/...` | CLI verified. |
| MCP | `hermes mcp serve/add/remove/list/test/configure/login/catalog/install` | Runtime list showed context7, n8n, zapier, gamelab enabled. |
| Kanban | `hermes kanban list/show/create/assign/reassign/...`; `hermes kanban list --json` | No `--limit` option; filter by status/assignee/tenant instead. |

## Gaps to resolve before implementation

1. ~~Direct chat API/WS surface is not verified.~~ **RESOLVED Phase 4**: `/api/plugins/chat/*` returns 404 (with valid auth) — no chat plugin exists. The dashboard chat surface is the `/api/pty` PTY WebSocket bridge (`hermes_cli/pty_bridge.py`), which speaks the PTY byte protocol to xterm.js in the SPA — not a chat-message protocol external apps can use. MissionControl has a prototype `hermesChatProxy.js`, but it is not the active browser transport; until Cloud hardens and injects a verified local CLI proxy or a direct chat REST/WS surface is added, `HermesChatTransport` signals unavailability and `chatBackbone` falls back to the explicit demo mock.
2. Real-time provider rate-limit/quota API is not verified. Ops v1 should label live quota as `unknown` unless real data exists.
3. Model switching is interactive by default. Dashboard-side model changes need a safe backend adapter and confirmation flow.
4. Credential management must remain status-only. No secret values in MissionControl.
5. Kanban WS `/events` is source-verified but not runtime socket-tested in this session. Add a Phase 3 smoke test.
6. ~~Dashboard docs and runtime differed on plugin auth.~~ **RESOLVED Phase 4**: Runtime/source authoritative; the canonical header is `X-Hermes-Session-Token` (source: `web_server.py:190`). The legacy `Authorization: Bearer <token>` path is still accepted for backward compatibility (`web_server.py:249-251`) but should not be used by new clients.
