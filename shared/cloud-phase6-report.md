# Cloud Phase 6 Report - Blocker and Path Forward

## Blocker: Frontend Build Failure due to Biscuit-owned usageStore Baseline

During the `docker build` process, the `pnpm run build` step failed with numerous TypeScript errors. These errors are predominantly located in `src/state/usageStore.ts`, `src/state/usageStore.test.ts`, `src/adapters/usageAdapter.ts`, `src/state/backbone.ts`, and `src/components/common/ConfirmDialog.tsx`.

This confirms the existing blocker documented in `AGENTS.md` and `OVERVIEW.md`: "If the repo build is failing due Biscuit-owned usageStore baseline, document and continue Cloud-owned work without hiding it."

The full list of TypeScript errors is available in the terminal output from the Docker build attempt. Key issues include:
- Type incompatibility between `RawUsageResponse` and expected payload types in `src/state/backbone.ts`.
- Missing or incompatible properties on `MetricInput`, `ProviderQuotaSnapshot`, `Tracked<UsageSnapshot>`, and `UsageSourcePayload` types in `src/adapters/usageAdapter.ts` and `src/state/usageStore.ts`.
- Inconsistent usage of `DataSource` enum values in `src/state/usageStore.ts` and `src/types/usage.ts`.
- Unintentional type comparisons (`TS2367`) and incorrect type usage leading to `string` not assignable to `never` errors.
- Unused declarations and missing properties in `src/components/common/ConfirmDialog.tsx`.
- Null checks implicitly failing (`TS18047`) in `usageStore.test.ts`.

**Impact:** The frontend application cannot be built or deployed until these TypeScript errors are resolved by Biscuit. This blocks the final deployment verification (step 4) for the entire application.

## Cloud-owned Work - Path Forward (Continuing Phase 6)

Despite the frontend build blocker, Cloud can continue defining and verifying the trusted adapter/proxy path for admin controls, and prepare deployment plans.

### 1. Verification of Hermes CLI/API Surfaces (Completed/Ongoing)

Verified CLI commands are available and responsive for:
- **Cron:** `hermes cron list` (reports "No scheduled jobs.")
- **Webhooks:** `hermes webhook list` (reports "No dynamic webhook subscriptions.")
- **Skills:** `hermes skills list` (shows 46 enabled skills).
- **MCP:** `hermes mcp list` (shows "headroom" MCP server as connected).
- **Profiles:** `hermes profile list` and `hermes profile show cloud` (provides profile details including model, gateway, skills).

These CLI surfaces serve as the foundation for the trusted adapter. The `shared/phase0-cloud-surface-map.md` accurately describes these surfaces.

### 2. Trusted Adapter/Proxy Path for Admin UI (Specification)

**Need:** The browser UI must not directly expose secrets or spawn unsafe CLI commands. A trusted adapter is required to mediate between the frontend and the Hermes CLI.

**Proposed Adapter Strategy:**
A Cloud-managed, lightweight Fastify (or similar Node.js/Python micro-service) proxy running on the Unraid/Tower host.
- **Location:** This proxy service will be deployed alongside the Sora-MissionControl frontend, potentially within its own Docker container or as part of the main application container if security concerns are mitigated. For now, a separate container is preferred for better isolation.
- **Functionality:**
    - **Authentication/Authorization:** The proxy will require proper authentication from the frontend (e.g., using a `DASHBOARD_TOKEN` as mentioned in `OVERVIEW.md`). It will *not* expose raw Hermes session tokens. Authorization logic will restrict which Hermes CLI commands can be executed by the frontend.
    - **Command Execution:** The proxy will execute allowed `hermes` CLI commands (e.g., `hermes cron list`, `hermes skills install`) and return their parsed output.
    - **Safe Guards:**
        - **Input Sanitization:** All input from the frontend to the CLI proxy will be sanitized to prevent injection attacks.
        - **Output Redaction:** Sensitive information (API keys, secrets) in CLI output will be redacted before being sent to the frontend.
        - **Confirmation Gates:** Commands with destructive potential (e.g., `hermes cron remove`, `hermes skills uninstall`) will require an explicit confirmation from the frontend which the proxy will enforce before executing.
        - **Model Selection Adapter:** For `hermes model` functions, the proxy will expose an endpoint that ensures safe model changes are logged and potentially rate-limited.
    - **Adapter Contracts (APIs):** Cloud will define explicit REST API endpoints for cron, webhook, skills, MCP, and model management within this proxy, which the frontend will consume.
        - Example (GET /api/cloud/cron/list): Proxies `hermes cron list`, parses output, redacts sensitive info, returns structured JSON.
        - Example (POST /api/cloud/cron/create): Accepts structured payload, constructs `hermes cron create` command, executes after confirmation (if required), and returns status.
- **Coordination with Biscuit:** The proxy's API contracts will be shared in `shared/` for Biscuit to implement the frontend integration. This keeps the backend (Cloud) and frontend (Biscuit) decoupled.

### 3. Deployment Path for Unraid/Tower (Confirmed)

- **Target Host:** Unraid/Tower (192.168.10.5) is the target for the Sora-MissionControl application.
- **Hermes/AI Host:** The Hermes/AI host (192.168.0.85) is where the Hermes Agent runs and will host the Cloud CLI Proxy service.
- **Path:** Docker containers managed by Docker Compose.
- **Port:** Sora-MissionControl frontend will be served on port 80 (via Nginx). The CLI proxy will expose its own internal port, potentially accessible only within the Docker network or on a specific local port (e.g., 8080) for authenticated access.
- **Container Strategy:**
    - **Sora-MissionControl Frontend:** Nginx-based container (as defined in `Dockerfile`) serving static files.
    - **Cloud CLI Proxy:** A separate, small Docker container (Node.js or Python) running the proxy logic. This container will have access to the host's Hermes CLI and configuration.

**Missing deploy artifacts created:**
- `Dockerfile`: Created for multi-stage build (Node.js/pnpm for build, Nginx for serve).
- `docker-compose.yml`: Created to define the `sora-mission-control` service.

## Next Steps for Cloud

1.  **Develop CLI Proxy Specifications:** The detailed specification for the CLI proxy's API endpoints, payloads, and security considerations has been created and placed in `shared/cloud-cli-proxy-spec.md`. This serves as the contract for Biscuit.
2.  **Report to Sora:** Inform Sora about the build blocker and the path forward for Cloud's responsibilities.

### Files Changed:
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `shared/cloud-phase6-report.md` (this file)
