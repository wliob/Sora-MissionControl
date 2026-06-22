# Phase 0 Cloud Surface Map: Hermes Agent

This document details the verified Hermes Agent endpoints, CLI commands, and relevant files for the Sora-MissionControl dashboard, focusing on the infrastructure and systems lead (Cloud) responsibilities.

## 1. Profile List & Status

### Verified Endpoints/Commands
- `hermes profile list`: Lists all available profiles.
- `hermes profile show <NAME>`: Shows details for a specific profile.

### Auth Requirements
- No explicit authentication required for CLI commands when run locally. Assumes local agent context.

### Redacted Sample Schemas (CLI Output)
```
# hermes profile list
NAME        STATUS    CURRENT
─────────── ───────── ───────
cloud       ACTIVE    ✓
dev         UNLOADED
test        UNLOADED

# hermes profile show cloud
Name: cloud
Home: /home/wliob/.hermes/profiles/cloud
Status: ACTIVE
Loaded Skills: [...]
Active Session: (...)
```

### Unavailable/Gap List
- Real-time profile status: The CLI provides snapshot data. A live connection for real-time status updates (e.g., active tasks, load) might require a dashboard API or polling, and is not directly available via simple CLI.

### Recommended Adapter Ownership for MissionControl
- **Cloud:** Owns the adapter for listing and showing profile details, primarily via `hermes profile` CLI commands or a dashboard API if one exists.

## 2. Chat Transport

### Verified Endpoints/Commands
- `hermes chat`: The primary CLI for interactive chat.
- `hermes chat -q "query"`: Non-interactive query.
- `/platforms` or `/gateway` (slash commands): Show platform connection status within an active Hermes session.

### Auth Requirements
- API keys for providers (in `~/.hermes/.env` or via `hermes auth`).
- Platform-specific authentication for gateways (e.g., bot tokens for Discord).

### Redacted Sample Schemas (CLI Output)
```
# hermes chat -q "hello"
... (agent response)
```

### Unavailable/Gap List
- Direct HTTP/WS API for sending/receiving chat messages and getting real-time thread updates without going through the main `hermes` process or the web gateway. The `OVERVIEW.md` mentions `HERMES_WS_URL` which suggests a WebSocket interface, but its exact structure needs verification.

### Recommended Adapter Ownership for MissionControl
- **Biscuit:** Chat UI and message forwarding to Hermes.
- **Cloud:** Owning the underlying long-lived WebSocket connection to `HERMES_WS_URL` and event processing to normalize chat events for the dashboard.

## 3. Usage and Rate Limits

### Verified Endpoints/Commands
- `hermes insights [--days N]`: Displays usage analytics.
- `/usage` (slash command): Shows token usage for the current session.
- `/gquota` (slash command): Shows Google Gemini Code Assist quota usage.

### Auth Requirements
- API keys for providers to accurately track usage.

### Redacted Sample Schemas (CLI Output)
```
# hermes insights
Hermes Agent Usage Insights (last 7 days)

Total Calls: 1234
Total Tokens: 567890 (Prompt: 400000, Completion: 167890)
Total Cost: $X.XX
...
```

### Unavailable/Gap List
- Centralized real-time API for combined usage data across all connected models and providers. Insights currently provide historical data.
- Direct API for checking real-time rate limit headers or remaining quota before making a call.

### Recommended Adapter Ownership for MissionControl
- **Cloud:** Owning adapters to poll/stream usage data from Hermes and, if available, directly from provider APIs for real-time rate limiting.

## 4. Model Switching

### Verified Endpoints/Commands
- `hermes model`: Interactive tool for selecting models/providers.
- `hermes config set model.default <MODEL_NAME>`: Sets the default model.
- `/model <name>` (slash command): Changes the model for the current session.

### Auth Requirements
- API keys for providers (in `~/.hermes/.env` or via `hermes auth`).

### Redacted Sample Schemas (CLI Output)
```
# hermes model
✓ Model changed to 'anthropic/claude-sonnet-4'
```

### Unavailable/Gap List
- Direct HTTP endpoint to list all available models with their capabilities and associated providers.
- Direct programmatic way to apply `hermes auth` changes without interaction.

### Recommended Adapter Ownership for MissionControl
- **Cloud:** Providing the backend for model listing and switching based on authenticated providers.

## 5. Cron Management

### Verified Endpoints/Commands
- `hermes cron list`: Lists all cron jobs.
- `hermes cron create <SCHEDULE> "<PROMPT>"`: Creates a new cron job.
- `hermes cron remove <JOB_ID>`: Removes a cron job.
- `/cron` (slash command): Manage cron jobs interactively.
- `cronjob` (tool): Programmatically manage cron jobs.

### Auth Requirements
- No explicit authentication for CLI commands.

### Redacted Sample Schemas (CLI Output)
```
# hermes cron list
ID        NAME                         SCHEDULE       STATUS
───────── ──────────────────────────── ────────────── ────────
job_123   Daily Report                 0 9 * * *      ACTIVE
job_456   Hourly Cleanup               every 1h       PAUSED
```

### Unavailable/Gap List
- Dashboard API for complete CRUD operations on cron jobs and real-time status/last run details. The `cronjob` tool is powerful but requires an agent process.

### Recommended Adapter Ownership for MissionControl
- **Cloud:** Full ownership of cron job management features.

## 6. Webhook Management

### Verified Endpoints/Commands
- `hermes webhook list`: Lists webhook subscriptions.
- `hermes webhook subscribe <NAME>`: Creates a new webhook route.
- `hermes webhook remove <NAME>`: Removes a webhook.
- `hermes webhook test <NAME>`: Sends a test POST request.
- Reference: `skill_view(name="autonomous-ai-agents/hermes-agent", file_path="references/webhooks.md")`

### Auth Requirements
- No explicit authentication for CLI commands.
- Secure token for incoming webhooks.

### Redacted Sample Schemas (CLI Output)
```
# hermes webhook list
NAME       URL                                       STATUS
────────── ───────────────────────────────────────── ────────
sora_alert http://localhost:8644/webhooks/sora_alert ACTIVE
```

### Unavailable/Gap List
- Real-time event stream of webhook activations.

### Recommended Adapter Ownership for MissionControl
- **Cloud:** Full ownership of webhook management features.

## 7. Keys/Secrets Access

### Verified Endpoints/Commands
- `hermes auth list`: Lists stored credentials (provider + index).
- `hermes auth add <PROVIDER>`: Interactive credential addition.
- `hermes config env-path`: Shows path to `.env` file.

### Auth Requirements
- Master password for `hermes auth` (if configured), direct filesystem access for `.env`.

### Redacted Sample Schemas (CLI Output)
```
# hermes auth list
Provider: openrouter (2 credentials)
  [0] active
  [1] inactive

Provider: anthropic (1 credential)
  [0] active
```

### Unavailable/Gap List
- Direct API to read/write specific secret values. This is a deliberate security measure.
- Direct way to programmatically check if a specific API key (e.g., `OPENROUTER_API_KEY`) is present and valid without triggering an agent call.

### Recommended Adapter Ownership for MissionControl
- **Cloud:** Adapters for displaying *status* of credentials (e.g., "OpenRouter configured", "Anthropic key missing") without exposing the values themselves. Direct management should primarily link to `hermes auth` CLI.

## 8. Skills/MCP Management

### Verified Endpoints/Commands
- **Skills:**
    - `hermes skills list`: Lists installed skills.
    - `hermes skills browse`: Lists all available skills from the hub.
    - `hermes skills install <ID>`: Installs a skill.
    - `hermes skills update`: Updates outdated skills.
    - `skill_view(name="<SKILL_NAME>")` (tool): View skill content
- **MCP:**
    - `hermes mcp list`: Lists configured MCP servers.
    - `hermes mcp test <NAME>`: Tests connection to an MCP server.

### Auth Requirements
- No explicit authentication for CLI commands.

### Redacted Sample Schemas (CLI Output)
```
# hermes skills list
NAME                      CATEGORY              DESCRIPTION
───────────────────────── ───────────────────── ──────────────────────────────────────────────────────────────────
hermes-agent              autonomous-ai-agents  Configure, extend, or contribute to Hermes Agent.
long-term-memory          None                  Read/write durable facts to ~/.hermes/long-term-memory.md.

# hermes mcp list
NAME        URL                         STATUS
─────────── ─────────────────────────── ────────
my-backend  http://localhost:8000/mcp   CONNECTED
```

### Unavailable/Gap List
- Real-time API for skill execution status or detailed MCP server health.
- Direct API for managing skill files (e.g., uploading new SKILL.md content). `skill_manage` tool exists but operates on existing skills or creating new ones based on content, not paths.

### Recommended Adapter Ownership for MissionControl
- **Cloud:** Full ownership of skill and MCP listing, status, and basic management functions (install/update/test).

## 9. Kanban Board & Events

### Verified Endpoints/Commands
- CLI commands: `hermes kanban list`, `hermes kanban show <ID>`, etc.
- Tool: `kanban` toolset (e.g., `kanban_show`, `kanban_create`).
- **Dashboard API (from OVERVIEW.md):**
    - `GET /api/plugins/kanban/board`: Kanban board snapshot.
    - `WS /api/plugins/kanban/events?token=...`: Real-time Kanban events.

### Auth Requirements
- For dashboard APIs: Token authentication (e.g., `HERMES_TOKEN` or a dynamically generated one for WS).

### Redacted Sample Schemas (API/CLI Output)
```json
// GET /api/plugins/kanban/board (simplified)
{
  "board_id": "main",
  "lanes": [
    {
      "id": "todo",
      "name": "To Do",
      "tasks": [
        {
          "id": "task_abc",
          "title": "Implement login screen",
          "assigned_to": "Biscuit",
          "status": "pending",
          "links": []
        }
      ]
    },
    {
      "id": "in_progress",
      "name": "In Progress",
      "tasks": []
    }
  ],
  "agents": [
    {"id": "Biscuit", "status": "active"},
    {"id": "Cloud", "status": "active"}
  ]
}

// WS /api/plugins/kanban/events?token=... (event example)
{
  "type": "task_updated",
  "payload": {
    "task_id": "task_abc",
    "field": "status",
    "old_value": "pending",
    "new_value": "in_progress",
    "agent_id": "Biscuit"
  }
}
```

### Unavailable/Gap List
- Full API documentation for all Kanban APIs and WebSocket events. The `OVERVIEW.md` provides two key ones, but a complete schema would be ideal.

### Recommended Adapter Ownership for MissionControl
- **Cloud:** Full ownership of Kanban API integration (both REST and WebSocket) to feed data into shared stores. This includes authentication for these endpoints.
- **Biscuit:** Ownership of the Kanban UI module, consuming data provided by Cloud's adapters.

---
## Summary of Adapter Ownership Decisions (Phase 0)

### Cloud (Systems & Infrastructure Lead)
-   **Profile Status:** Listing and basic details via CLI.
-   **Live Data / Auth Backbone:**
    -   Underlying WebSocket connection to Hermes (for chat, Kanban events).
    -   Processing and normalizing event streams.
    -   API integration for Kanban board (GET), usage/rate limits, model listing/switching, cron management, webhook management, and credential status (without exposing values).
-   **Admin Control Module:**
    -   Full backend for managing models, crons, webhooks, skills, and MCPs (listing, status, basic CRUD where APIs exist).
-   **Live Ops / Usage Module:**
    -   Providing usage analytics, potentially integrating real-time rate limits.

### Biscuit (Application Implementation Lead)
-   **Chat Module:** UI implementation, sending messages via Cloud's transport.
-   **Kanban Module:** UI presentation of board and task details, actions triggering Cloud-owned APIs.
-   **3D Office Module:** Integration of 3D Office v2 code/assets, consuming data from shared stores.
-   **Dashboard Shell / Navigation:** Core UI, routing, and layout.

### Korra (Creative / Visual Design Lead)
- **Visual System:** Color, typography, spacing, motion rules for the entire dashboard.

This document serves as the foundation for freezing the section contracts and proceeding with Phase 1.
