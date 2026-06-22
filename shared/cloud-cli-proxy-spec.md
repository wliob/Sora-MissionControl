# Cloud CLI Proxy Specification

This document outlines the design for a secure proxy to expose specific Hermes CLI functionalities as REST endpoints. The proxy aims to provide controlled access to Hermes Agent's capabilities for automation and integration with other systems.

## 1. Authentication Model
- **Mechanism:** API Key-based authentication. A unique API key will be generated for each authorized client (e.g., Unraid server n8n workflows).
- **Key Storage:** Keys will be stored securely on the Hermes/AI host within the proxy service's configuration, hashed.
- **Validation:** Each incoming request MUST include an `X-API-Key` header with a valid API key. Requests with missing or invalid keys will be rejected with a `401 Unauthorized` response.

## 2. Allowed Hermes Commands and Endpoints

Only a strict subset of Hermes CLI commands will be exposed. Each exposed command will have a dedicated REST endpoint.

### 2.1 Cron Job Management

- **Allowed Commands:** `cronjob create`, `cronjob list`, `cronjob update`, `cronjob pause`, `cronjob resume`, `cronjob remove`, `cronjob run`.
- **Redaction Rules:** API key used to create or modify a cron job should be redacted from any output. Content of `script` and `prompt` fields should be redacted or truncated in `list` output to prevent sensitive information exposure without explicit retrieval.
- **Confirmation Enforcement:**
    - `cronjob remove` and `cronjob update` (if modifying sensitive fields like `script` or `prompt`) will require an explicit `confirm: true` field in the payload to prevent accidental destructive actions.
- **Error Handling:** Standard HTTP error codes (e.g., `400 Bad Request` for invalid parameters, `500 Internal Server Error` for execution failures) with detailed, but non-sensitive, error messages.

#### Endpoints:
- `POST /cron/jobs` (for `cronjob create`)
    - Payload: `{ "action": "create", "schedule": "...", "prompt": "...", "skills": [...] }`
- `GET /cron/jobs` (for `cronjob list`)
    - Response: `[ { "id": "...", "name": "...", "schedule": "..." }, ... ]` (redacted prompt/script)
- `GET /cron/jobs/{job_id}` (for `cronjob list` specific job details)
    - Response: `{ "id": "...", "name": "...", "schedule": "...", "prompt": "...", "script": "..." }`
- `PUT /cron/jobs/{job_id}` (for `cronjob update`)
    - Payload: `{ "action": "update", "schedule": "...", "prompt": "...", "confirm": true }`
- `POST /cron/jobs/{job_id}/pause` (for `cronjob pause`)
- `POST /cron/jobs/{job_id}/resume` (for `cronjob resume`)
- `POST /cron/jobs/{job_id}/run` (for `cronjob run`)
- `DELETE /cron/jobs/{job_id}` (for `cronjob remove`)
    - Payload: `{ "confirm": true }`

### 2.2 Webhook Management

- **Allowed Commands:** `webhook create`, `webhook list`, `webhook remove`.
- **Redaction Rules:** Webhook secrets/tokens should never be exposed in `list` or `get` operations. Callback URLs should be carefully validated.
- **Confirmation Enforcement:** `webhook remove` requires explicit `confirm: true`.
- **Error Handling:** Standard HTTP error codes.

#### Endpoints:
- `POST /webhooks` (for `webhook create`)
    - Payload: `{ "event": "...", "url": "...", "name": "..." }`
- `GET /webhooks` (for `webhook list`)
- `DELETE /webhooks/{webhook_id}` (for `webhook remove`)
    - Payload: `{ "confirm": true }`

### 2.3 Skill Management

- **Allowed Commands:** `skills list`, `skill view` (only to view SKILL.md, not linked files directly without explicit authorization). `skill create`, `skill patch`, `skill edit` are NOT allowed via proxy for security reasons; require direct CLI access.
- **Redaction Rules:** Ensure `skill view` does not expose sensitive paths or credentials from skill internals.
- **Confirmation Enforcement:** N/A (read-only for proxy).
- **Error Handling:** Standard HTTP error codes.

#### Endpoints:
- `GET /skills` (for `skills list`)
- `GET /skills/{skill_name}` (for `skill view SKILL.md`)

### 2.4 MCP (Message Control Plane) Status

- **Allowed Commands:** `mcp_headroom_headroom_stats` (read-only). No compression/retrieval via proxy as it implies content exposure.
- **Redaction Rules:** N/A (stats only).
- **Confirmation Enforcement:** N/A.
- **Error Handling:** Standard HTTP error codes.

#### Endpoints:
- `GET /mcp/headroom/stats` (for `mcp_headroom_headroom_stats`)

### 2.5 Models and Profile Status

- **Allowed Commands:** Read-only access to available models and current profile status (e.g., loaded skills, active profile name).
- **Redaction Rules:** Ensure no API keys or sensitive model configuration details are exposed.
- **Confirmation Enforcement:** N/A.
- **Error Handling:** Standard HTTP error codes.

#### Endpoints:
- `GET /status/models` (list available models and their providers)
- `GET /status/profile` (show active profile name, loaded skills, general status)

### 2.6 Keys Status (API Keys, etc.)

- **Allowed Commands:** Read-only, status check of API keys (e.g., is the key valid, when does it expire, what permissions does it have). No exposure of the keys themselves.
- **Redaction Rules:** Never expose actual key values.
- **Confirmation Enforcement:** N/A.
- **Error Handling:** Standard HTTP error codes.

#### Endpoints:
- `GET /status/keys/{key_id}` (status of a specific API key without exposing its value)

## 3. Redaction Rules Summary
- All API keys, secrets, and sensitive tokens MUST be redacted from any output.
- `cronjob list` output should truncate or redact `prompt` and `script` content. Full content retrieval requires a specific endpoint (`GET /cron/jobs/{job_id}`) and implicit authorization via the API key.
- `skill view` should only return SKILL.md content, not other linked files (e.g., templates, scripts) as they might contain credentials or sensitive logic.

## 4. Error Handling
- Use standard HTTP status codes (e.g., 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error).
- Error responses should be JSON objects, including a `code`, `message`, and optionally `details` for validation errors.
- Error messages should be informative but should not leak sensitive system information or internal stack traces.

## 5. Deployment / Bridge
- The proxy service will reside on the Hermes/AI host (192.168.0.85).
- Communication from Unraid/Tower (192.168.10.5) to the proxy will be via HTTP/S over the internal network.
- Secure communication via TLS (HTTPS) is REQUIRED for all endpoints. Self-signed certificates can be used for internal communication if proper trust is established on the client side.
- Firewall rules on the Hermes/AI host MUST restrict access to the proxy's port (e.g., 8080) only from the Unraid/Tower IP address (192.168.10.5).

This specification provides a secure and controlled mechanism for external systems to interact with specific, non-destructive Hermes Agent functionalities.