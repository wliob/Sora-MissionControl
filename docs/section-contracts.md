# Sora-MissionControl Section Contracts

Status: Phase 0 contract freeze.

These contracts let Cloud, Biscuit, and Korra work independently without state collisions.

## Global rules

1. Shared backbone owns transport, auth, freshness, and normalization.
2. UI modules consume typed stores/adapters; they do not fetch Hermes directly unless their contract says so.
3. Secrets never leave the backend/trusted local process. UI shows presence/status only.
4. Every data item exposed to UI carries `source`, `freshness`, and `confidence` when uncertainty exists.
5. The first-screen trio remains binding: Office = presence truth, Chat = command surface, Ops = risk/cost telemetry.
6. No module invents fake metrics, placeholder live states, or unverified endpoint output.
7. `prefers-reduced-motion` and touch targets apply across all modules.

## Shared data/auth backbone

Owner: Cloud.

### Inputs

- Dashboard base URL, default `http://192.168.0.85:9119`.
- Dashboard session token/cookie sourced from trusted local runtime.
- Profile filesystem/config paths under `~/.hermes/profiles/<name>/`.
- Kanban REST/WS endpoints under `/api/plugins/kanban`.
- CLI adapters for profiles, cron, webhook, skills, MCP, insights, auth/status.

### Outputs

```ts
interface ConnectionState {
  dashboard: SourceHealth;
  kanbanRest: SourceHealth;
  kanbanWs: SourceHealth;
  profileCli: SourceHealth;
  usage: SourceHealth;
}

interface SourceHealth {
  state: 'connected' | 'degraded' | 'offline' | 'unauthorized' | 'unknown';
  lastOkAt: string | null;
  lastCheckedAt: string;
  latencyMs?: number;
  error?: string;
}
```

Shared stores/events:

- `boardStore`: latest Kanban board snapshot.
- `kanbanEventBus`: normalized WS/event rows.
- `profileStore`: profile roster, gateway status, model summary, skill count.
- `usageStore`: historical usage plus real-time quota fields when verified.
- `adminStore`: crons, webhooks, skills, MCP, credential status.
- `connectionStore`: source health/freshness.

### Owned state

- Session token handling and refresh/invalid state.
- REST/WS clients and reconnect/backoff.
- CLI invocation/proxy boundary.
- Source freshness/confidence metadata.
- Error normalization.

### Emitted events

- `connection.changed`
- `board.snapshot.updated`
- `kanban.event.received`
- `profile.roster.updated`
- `profile.status.changed`
- `usage.snapshot.updated`
- `admin.resource.updated`
- `auth.invalidated`

### Forbidden dependencies

- No Pixi/office runtime imports.
- No DOM/component styling decisions beyond severity/status enums.
- No direct React state imports.
- No secret values in returned payloads.

## Office module

Owner: Biscuit. Visual acceptance: Korra.
Source: Hermes 3D Office v2.

### Inputs

Preferred Phase 0 decision: FSM stays inside the office module. Shared backbone pushes board snapshots and events.

```ts
interface OfficeModuleApi {
  init(options: OfficeInitOptions): Promise<void>;
  applyBoardSnapshot(board: KanbanBoardResponse): void;
  applyWsEvent(event: KanbanEvent): void;
  focusAgent(agentId: AgentId | null): void;
  focusZone(zoneId: OfficeZoneId | null): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

interface OfficeInitOptions {
  container: HTMLElement;
  width: number;
  height: number;
  assetBaseUrl: string;
  prefersReducedMotion: boolean;
  onAgentSelected?: (agentId: AgentId | null) => void;
  onZoneFocused?: (zoneId: OfficeZoneId | null) => void;
  onFpsUpdate?: (fps: number) => void;
  onReady?: () => void;
  onError?: (error: OfficeError) => void;
}
```

### Outputs

- `agentSelected(agentId | null)`
- `zoneFocused(zoneId | null)`
- `fpsUpdate(fps)`
- `ready()`
- `error({ code, message })`

### Owned state

- Pixi `Application` and scene graph.
- Agents, sprites, textures, atlases, FX.
- Agent FSM actors and board-to-activity mapping.
- Camera/pan/zoom/follow state.
- Office performance counters.

### Forbidden dependencies

- No auth/session/localStorage/sessionStorage.
- No REST/WS clients.
- No shared `connectionStore` import.
- No `window.__*` globals.
- No chat/ops/admin/Kanban module imports.
- No standalone v2 shell components.

### Reuse requirements

Copy/rework from v2:

- `src/engine/iso.ts`
- `src/engine/pathfinding.ts`
- `src/engine/AgentStateMachine.ts`
- `src/entities/Agent.ts`
- `src/entities/AgentController.ts`
- `src/engine/GameRuntime.ts`
- `public/assets/atlases/`
- FSM tests and mock event stream where useful.

Required fixups:

- Make `ATLAS_BASE` configurable via `assetBaseUrl`.
- Rebuild React wrapper as `<OfficeCanvas/>` with refs/callbacks, not globals.
- Do not copy `OfficeShell`, `AuthGate`, `TopBar`, v2 stores, v2 API clients, or v2 server.

## Chat module

Owner: Biscuit. Transport support: Cloud.

### Inputs

```ts
interface ChatTransport {
  listProfiles(): Promise<ProfileSummary[]>;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  subscribe?(handler: (event: ChatEvent) => void): () => void;
}

interface SendMessageInput {
  profile: AgentId;
  message: string;
  sessionId?: string;
  context?: Record<string, unknown>;
}
```

### Outputs

- `chat.message.sent`
- `chat.message.received`
- `chat.profile.selected`
- `chat.command.submitted`
- `chat.error`

### Owned state

- Selected profile/thread.
- Draft message/composer state.
- Local UI grouping/filtering.

### Forbidden dependencies

- No CLI spawning from browser UI.
- No direct secret/provider access.
- No independent profile roster; consume shared `profileStore`.
- No consumer-messenger bubble style; command-console visual language only.

## Live ops / usage module

Owner: Cloud. UI implementation: Biscuit. Visual acceptance: Korra.

### Inputs

- `connectionStore`
- `usageStore`
- `profileStore`
- `adminStore` alert summaries

### Outputs

- `ops.alert.acknowledged`
- `ops.source.selected`
- `ops.threshold.changed` (future)

### Owned state

- UI filters, selected source, acknowledged-alert local state.

### Forbidden dependencies

- No fake quota/rate-limit values.
- No marketing KPI cards.
- No raw JSON final UI.
- Unknown must display as `unknown`, not green.

## Admin/control module

Owner: Cloud. UI implementation: Biscuit. Visual acceptance: Korra.

### Inputs

- Models/fallback config summary.
- Cron list/status.
- Webhook list/status.
- Credential provider presence/status, never values.
- Skills list/update/audit status.
- MCP list/test status.
- Kanban orchestration/config.

### Outputs

- `admin.action.requested` with action type and confirmation requirements.
- `admin.action.completed`
- `admin.action.failed`

### Destructive/high-risk actions

Must require explicit confirm UI:

- Delete/disable webhook.
- Delete cron.
- Terminate run.
- Reclaim active task.
- Archive/delete board/task.
- Change model/provider/fallback.
- Install/update/uninstall skills/MCP.
- Any action touching credentials.

### Forbidden dependencies

- No secret values.
- No hidden automatic changes.
- No model/provider switch without displaying target profile and rollback note.

## Kanban/project control module

Owner: Biscuit. Data adapter: Cloud.

### Inputs

- `boardStore`
- `kanbanEventBus`
- `profileStore`
- `connectionStore`

### Outputs

- `kanban.task.selected`
- `kanban.task.action.requested`
- `kanban.filter.changed`
- `kanban.owner.focused`

### Owned state

- Filters, selected task, drawer state, display grouping.

### Forbidden dependencies

- No direct DB access.
- No direct WS client.
- No duplicate board store.
- No auto-dispatch surprises; all dispatch/decompose actions must show cost/risk and be user-confirmed.

## Visual system / shell

Owner: Korra for acceptance, Biscuit for implementation.

### Required first-screen hierarchy

1. Hermes connection/live state.
2. Agent presence and movement in office.
3. Command/chat availability.
4. Cost/rate-limit/system risk.
5. Deeper admin/project navigation.

### Forbidden patterns

- Generic AI gradients, neural lines, particle hero effects.
- KPI grid spam.
- Fake charts or fake metrics.
- Rainbow agent UI.
- Stock admin template look.
- Heavy glassmorphism/card clutter.
- Consumer-chat bubble styling.

## Phase handoff gates

- Phase 1 cannot start until design tokens and shell layout are accepted.
- Phase 2 cannot start until office asset path, Pixi/XState versions, and runtime smoke test pass.
- Phase 3 cannot start until Cloud verifies auth and adapter boundaries.
- Phase 4 chat cannot start until `ChatTransport` is real or explicitly mocked.
- Phase 5 ops cannot show rate limits as live unless provider data is verified.
