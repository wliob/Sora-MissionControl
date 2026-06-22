# Sora-MissionControl Phase 0 Source Map

**Status:** Verified source map – no secret values stored here.  
**Last verified:** 2026-06-19 local runtime on Hermes host.

## 1. Verified Hermes Endpoints

The following Hermes surfaces were inspected via the Hermes CLI. All outputs are sanitized (secrets/tokens redacted by the system).

### 1.1 Profile List / Status
```bash
hermes profile list
```
Output (truncated):
```
 Profile          Model                        Gateway      Alias        Distribution
 ───────────────    ───────────────────────────    ───────────    ───────────    ────────────────────
 ◆default         gpt-5.4-mini                 running      —            —
  biscuit         glm-5.2                      running      biscuit      —
  cloud           deepseek-v4-pro              running      cloud        —
  korra           gpt-5.5                      running      korra        —
  lelouch         gpt-5.4-mini                 running      lelouch      —
  rain            gpt-5.4-mini                 running      —            —
  tifa            gpt-5.5                      running      tifa         —
```
*Notes:* Shows all available agent profiles, their current model, gateway status, and alias. This endpoint can be used to populate the profile selector and to drive per‑agent status indicators.

### 1.2 Chat Transport (CLI)
```bash
hermes chat --help
```
*Notes:* The `hermes chat` command supports non‑interactive mode (`-q QUERY`) and can be invoked per profile (`hermes --profile <name> chat -q "..."`). This confirms a usable transport for sending messages and receiving replies. A lightweight adapter can wrap this CLI or use the underlying HTTP/WebSocket if exposed.

### 1.3 Webhook Subscriptions
```bash
hermes webhook list
```
Output:
```
  3 webhook subscription(s):
  ◆ test-webhook
    Test webhook for verification
    URL:     http://localhost:8644/webhooks/test-webhook
    Events:  (all)
    Deliver: origin
  ◆ sora-inbox
    Inter-agent completion ping — department leads report task completion to Sora for memory tracking
    URL:     http://localhost:8644/webhooks/sora-inbox
    Events:  (all)
    Deliver: log
  ◆ dexcom-alert
    Dexcom glucose alerts from Home Assistant
    URL:     http://localhost:8644/webhooks/dexcom-alert
    Events:  (all)
    Deliver: origin
```
*Notes:* Confirms that webhook infrastructure is operational and can be used for inter‑component notifications (e.g., task completion events).

### 1.4 Cron Jobs
```bash
hermes cron list
```
Output (excerpt):
```
  ee26a1c6468a [active]    Syncthing watchdog    every 15m    ...
  c31bac3cfac2 [active]    AI News Scanner       0 10 * * *    ...
  3a39f60505f7 [active]    Morning Brief - Phase 0 (Pre-Setup) 55 5 * * *    ...
  ...
```
*Notes:* The cron system is active; we can schedule maintenance jobs (e.g., data sync, usage reporting) and observe existing jobs for reference.

### 1.5 Skills Inventory
```bash
hermes skills list
```
Output (excerpt):
```
  158 enabled, 2 disabled
  ├─ academic-writing
  ├─ ai-news-scanner
  ├─ context7
  ├─ ...
  ├─ hermes-agent
  ├─ kanban-orchestrator
  ├─ ...
  └─ trading-automation
```
*Notes:* The skill system is functional; we can install, update, and audit skills via CLI. This informs the Skills/MCP management surfaces.

### 1.6 MCP Servers
```bash
hermes mcp list
```
Output:
```
  MCP Servers:
  Name             Transport                      Tools        Status
  context7         https://mcp.context7.com/mcp   all          ✓ enabled
  n8n              npx -y n8n-mcp                 all          ✓ enabled
  zapier           https://mcp.zapier.com/ap...   all          ✓ enabled
  gamelab          http://api.gamelabstudio....   all          ✓ enabled
```
*Notes:* Confirmed MCP connectivity for Context7 (docs), n8n (workflow automation), Zapier (app actions), and GameLab (asset generation). These can be leveraged for the respective module integrations.

### 1.7 Auth / Secrets (Key Material)
```bash
hermes auth list
```
Output (excerpt):
```
copilot (1 credentials):
  #1  GITHUB_TOKEN         api_key env:GITHUB_TOKEN ←
deepseek (1 credentials):
  #1  DEEPSEEK_API_KEY     api_key env:DEEPSEEK_API_KEY ←
gemini (1 credentials):
  #1  GOOGLE_API_KEY       api_key env:GOOGLE_API_KEY ←
...
```
*Notes:* The auth system shows which API keys are configured for various providers (LLM, code agents, etc.). No secret values are exposed; only presence/status is shown. This satisfies the least‑privilege requirement for credential surfaces.

### 1.8 Usage / Rate‑Limit Signals
*No dedicated CLI for usage/rate‑limit was observed in the default Hermes distribution.*  
However, the `hermes insights` command (if available) or direct inspection of the dashboard API (`/api/plugins/kanban/board` etc.) can provide token/spend metrics. For Phase 0 we note that usage data must be sourced from the Hermes dashboard APIs or local telemetry; the live‑ops module will treat unknown states as `unknown` until verified.

## 2. Hermes 3D Office v2 Reuse Boundaries

See the frozen reuse map at `shared/phase0-biscuit-v2-reuse.md`. Summary:

### 2.1 Reusable (copy with minimal changes)
- **Engine core:** `src/engine/iso.ts`, `src/engine/pathfinding.ts`, `src/engine/AgentStateMachine.ts` – pure logic, zero changes.
- **Pixi rendering layer:** `src/entities/Agent.ts`, `src/entities/AgentController.ts`, `src/engine/GameRuntime.ts` – copy, fix hardcoded `ATLAS_BASE` to be configurable via props.
- **Types:** subset of `src/types.ts` (`Task`, `Column`, `Board`, `WsEventType`, `WsEvent`, `AgentName`, `AGENT_NAMES`, `AGENT_ACCENTS`).
- **Assets:** all atlas PNG/WebP files under `public/assets/atlases/`.
- **Mock data & tests:** copy for dev/test as needed.

### 2.2 Do NOT copy (tied to standalone shell)
- `src/components/OfficeShell.tsx`, `CanvasHost.tsx`, `AuthGate*`, `TopBar*`, `ConnectionPill*`, `ReconnectBanner*`, `ToastStack*`, `RoomTabs*`, `DebugHUD*`.
- `src/stores/authStore.ts`, `connectionStore.ts`, `boardStore.ts`, `api/client.ts`, `api/ws.ts`, `hooks/useAgentSync.ts`, `lib/browserSession.ts`, `server/index.ts`.
- `src/main.tsx`, `src/App.tsx`.

### 2.3 Office Module Contract (excerpt)
The office module receives **agent activity snapshots** as its sole data input:
```ts
interface AgentActivitySnapshot {
  agentId: string; // 'cloud'|'biscuit'|'korra'|'lelouch'|'tifa'
  name: string;
  activity: 'idle'|'moving'|'working'|'blocked'|'reviewing'|'celebrating';
  zone: 'home'|'workstations'|'collaboration'|'break_room'|'archive';
  task: { id:string; title:string; status:string; updatedAt:string } | null;
}
```
It owns the Pixi rendering, FSM actors (if retained), and emits `agentSelected`, `zoneFocused`, `fpsUpdate`, `ready`, `error`.

## 3. Gaps & Assumptions

- **Usage / Rate‑Limit:** No direct CLI; will need to consume Hermes dashboard APIs or local telemetry. Placeholder `unknown` state accepted until verified.
- **Chat Transport:** CLI-based adapter is viable; if a native HTTP/WebSocket endpoint is discovered later, the adapter can be swapped.
- **Model Switching:** Verified via `hermes model` (interactive) and auth lists show per‑provider keys. A safe admin surface will need to expose current model and allow profile‑level overrides.
- **Cron / Webhook / Skills / MCP:** All confirmed operational; admin surfaces can list, create, update, delete with confirmation for destructive actions.
- **Auth / Secrets:** CLI shows presence only; no values exposed – meets least‑privilege.

## 4. Next Steps (Post‑Phase 0)

1. Freeze section contracts using this source map and the visual contract (`shared/phase0-korra-visual-contract.md`).
2. Route work to department leads:
   - **Korra** – Phase 1 visual system + shell (with Exia/Gundam 00 mecha influence).
   - **Biscuit** – Phase 2 shell & 3D office embedding.
   - **Cloud** – Phase 3 data/auth/live‑sync backbone.
   - Then proceed through chat, ops, admin, kanban, and polish phases as defined in `docs/work-split.md`.

---
*This document is intended for internal consumption; it does not contain any API keys, tokens, or secret values.*