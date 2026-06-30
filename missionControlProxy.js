import express from 'express';
import bodyParser from 'body-parser';
import { execFile } from 'child_process';
import { timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import net from 'net';
import https from 'https';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_PROXY_PORT = 3187;
export const DEFAULT_PROXY_HOST = process.env.MISSION_CONTROL_PROXY_HOST ?? '0.0.0.0';

export function stripNoise(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter((line) => !line.includes('Bitwarden Secrets Manager: applied'))
    .join('\n')
    .trim();
}

async function runHermes(args, timeout = 25_000) {
  try {
    const { stdout, stderr } = await execFileAsync('hermes', args, {
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, HERMES_ACCEPT_HOOKS: '1' },
    });
    return stripNoise(stdout || stderr);
  } catch (error) {
    const stdout = stripNoise(error.stdout ?? '');
    const stderr = stripNoise(error.stderr ?? error.message);
    const err = new Error(stderr || stdout || error.message);
    err.stdout = stdout;
    err.stderr = stderr;
    err.code = error.code;
    throw err;
  }
}

export function isoOrNull(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : trimmed;
}

// ── Argument sanitization ────────────────────────────────────────────

const SHELL_METACHARS = /[$`"|&;<>~#*?!(){}\\]/;
const REJECT_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function sanitizeError(message) {
  if (!message) return 'Internal server error';
  let sanitized = String(message)
    .replace(/\/home\/[^/\s]+/g, '/home/<user>')
    .replace(/\/Users\/[^/\s]+/g, '/Users/<user>')
    .replace(/\/[a-zA-Z0-9_-]*\.?hermes[^\s]*/gi, '<hermes-path>')
    .replace(/MISSION_CONTROL_[A-Z0-9_]+/g, '<env-var>')
    .replace(/HERMES_[A-Z0-9_]+/g, '<env-var>');
  if (!sanitized || sanitized.length < 5) return 'Internal server error';
  return sanitized;
}

function sanitizeArg(arg, rule) {
  const value = String(arg ?? '').trim();
  if (!value) return { valid: false, reason: 'Argument must not be empty.' };

  if (value.startsWith('--')) {
    return { valid: false, reason: `Argument "${value}" starts with "--" which is not allowed to prevent flag injection.` };
  }
  if (value.startsWith('-') && !/^-[a-zA-Z0-9]/.test(value)) {
    return { valid: false, reason: `Argument "${value}" starts with a suspicious flag prefix.` };
  }

  if (/[\r\n\x00]/.test(value)) {
    return { valid: false, reason: 'Argument contains control characters.' };
  }

  if (rule === 'id') {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9:_/.-]*$/.test(value)) {
      return { valid: false, reason: `ID "${value}" contains invalid characters.` };
    }
    return { valid: true, value };
  } else if (rule === 'name') {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9 _.-]*$/.test(value)) {
      return { valid: false, reason: `Name "${value}" contains invalid characters.` };
    }
    return { valid: true, value };
  } else if (rule === 'url') {
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s]+$/.test(value)) {
      return { valid: false, reason: `URL "${value}" is not a valid URL.` };
    }
    return { valid: true, value };
  } else if (rule === 'schedule') {
    if (!/^(@(yearly|annually|monthly|weekly|daily|hourly|reboot)|(@every\s+\d+(ns|us|ms|s|m|h))|([*\-\d,\/]+\s+){4,5}[*\-\d,\/]+)$/.test(value)) {
      return { valid: false, reason: `Schedule "${value}" does not look like a valid cron expression.` };
    }
    return { valid: true, value };
  } else if (rule === 'safe') {
    // General safe text — check shell metacharacters and strip control chars
    if (SHELL_METACHARS.test(value)) {
      return { valid: false, reason: `Argument contains shell metacharacters.` };
    }
    const clean = value.replace(REJECT_CHARS, '');
    if (!clean) return { valid: false, reason: 'Argument contains only control characters.' };
    return { valid: true, value: clean };
  }

  // Unknown rule — fall through to generic shell metacharacters check
  if (SHELL_METACHARS.test(value)) {
    return { valid: false, reason: `Argument "${value}" contains shell metacharacters.` };
  }
  return { valid: true, value };
}

export function maskLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '••••';
  if (raw.startsWith('env:')) return `env:${raw.slice(4, 7)}••••${raw.slice(-4)}`;
  if (raw.length <= 8) return `••••${raw.slice(-2)}`;
  return `${raw.slice(0, 4)}••••${raw.slice(-4)}`;
}

function normalizeHost(host) {
  return String(host ?? '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .split(':')[0]
    .toLowerCase();
}

function normalizeIpAddress(value) {
  return String(value ?? '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/^::ffff:/i, '')
    .toLowerCase();
}

function isLoopbackHost(host) {
  return new Set(['localhost', '127.0.0.1', '::1']).has(normalizeHost(host));
}

function isLoopbackAddress(address) {
  const normalized = normalizeIpAddress(address);
  if (!normalized) return false;
  const normalizedNoBrackets = normalized.replace(/^\[|\]$/g, '');
  if (normalizedNoBrackets === '::1' || normalizedNoBrackets === '127.0.0.1') return true;
  if (net.isIP(normalizedNoBrackets) === 6 && normalizedNoBrackets.startsWith('::1')) return true;
  return false;
}

export function parseTrustedProxyPeers(value) {
  return parseCorsOriginList(value).map((address) => normalizeIpAddress(address));
}

function boolEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function resolveRequireSecureTransport(value) {
  if (typeof value === 'boolean') return value;

  const envValue = process.env.MISSION_CONTROL_REQUIRE_SECURE_TRANSPORT;
  if (envValue === undefined || String(envValue).trim() === '') {
    return true;
  }

  return boolEnv(envValue);
}

export function parseCorsOriginList(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function resolveCorsOrigin({ requestOrigin, requestHost, configuredOrigins = [] }) {
  if (!requestOrigin) return null;

  if (configuredOrigins.includes('*')) {
    return '*';
  }

  if (configuredOrigins.length > 0) {
    return configuredOrigins.includes(requestOrigin) ? requestOrigin : null;
  }

  try {
    const requestUrl = new URL(requestOrigin);
    const originHost = normalizeHost(requestUrl.hostname);
    const proxyHost = normalizeHost(requestHost);
    if (!originHost || !proxyHost) return null;
    if (originHost === proxyHost) return requestOrigin;
    if (isLoopbackHost(originHost) && isLoopbackHost(proxyHost)) return requestOrigin;
    return null;
  } catch {
    return null;
  }
}

function normalizeAuthMode(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function constantTimeTokenMatch(expected, provided) {
  const expectedBuffer = Buffer.from(String(expected ?? ''), 'utf8');
  const providedBuffer = Buffer.from(String(provided ?? ''), 'utf8');
  if (expectedBuffer.length === 0 || expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function resolveProxyAuthConfig(options = {}) {
  const token = String(options.apiKey ?? process.env.MISSION_CONTROL_ADMIN_PROXY_KEY ?? '').trim();
  const mode = normalizeAuthMode(options.authMode ?? process.env.MISSION_CONTROL_PROXY_AUTH_MODE ?? '');
  const explicitRequired = new Set(['required', 'production', 'token-required']).has(mode);
  const explicitDisabled = new Set(['off', 'disabled', 'none']).has(mode);

  if (mode && !explicitRequired && !explicitDisabled && mode !== 'optional') {
    throw new Error(`Unsupported MISSION_CONTROL_PROXY_AUTH_MODE "${mode}". Use "required", "optional", or leave it unset for local development.`);
  }

  if (explicitRequired && !token) {
    throw new Error('MISSION_CONTROL_PROXY_AUTH_MODE=required requires MISSION_CONTROL_ADMIN_PROXY_KEY to be set.');
  }

  return {
    required: explicitRequired || (!explicitDisabled && Boolean(token)),
    token: token || null,
  };
}

export function isAdminProxyRequestAuthorized({ path: requestPath, providedToken, auth }) {
  if (!String(requestPath ?? '').startsWith('/admin/')) return true;
  if (!auth.required) return true;
  return constantTimeTokenMatch(auth.token, providedToken);
}

export function parseCronList(text) {
  const lines = text.split(/\r?\n/);
  const jobs = [];
  let current = null;
  const commit = () => {
    if (!current) return;
    jobs.push({
      id: current.id,
      name: current.name ?? current.id,
      schedule: current.schedule ?? 'unknown',
      enabled: current.status !== 'paused' && current.status !== 'disabled',
      paused: current.status === 'paused',
      promptPreview: current.promptPreview ?? null,
      hasScript: Boolean(current.script),
      skills: current.skills ?? [],
      modelOverride: current.modelOverride ?? null,
      lastRunAt: isoOrNull(current.lastRunAt),
      nextRunAt: isoOrNull(current.nextRunAt),
      createdAt: current.createdAt ?? new Date(0).toISOString(),
      error: current.error ?? null,
    });
  };
  for (const line of lines) {
    const header = line.match(/^\s*([a-f0-9]{8,})\s+\[([^\]]+)\]/i);
    if (header) {
      commit();
      current = { id: header[1], status: header[2] };
      continue;
    }
    if (!current) continue;
    const field = line.match(/^\s*([A-Za-z ]+):\s*(.*)$/);
    if (!field) continue;
    const key = field[1].trim().toLowerCase();
    const value = field[2].trim();
    if (key === 'name') current.name = value;
    if (key === 'schedule') current.schedule = value;
    if (key === 'next run') current.nextRunAt = value;
    if (key === 'script') current.script = value;
    if (key === 'skills') current.skills = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (key === 'model') current.modelOverride = value || null;
    if (key === 'last run') {
      current.lastRunAt = value.replace(/\s+(ok|error).*$/i, '');
      if (/\berror\b/i.test(value)) current.error = value;
    }
  }
  commit();
  return jobs;
}

export function shouldTreatWebhookListAsUnavailable(text) {
  return /Webhook platform is not enabled/i.test(text);
}

export function parseWebhookList(text) {
  const lines = text.split(/\r?\n/);
  const hooks = [];
  let current = null;
  const commit = () => {
    if (!current) return;
    hooks.push({
      id: current.id,
      name: current.description || current.id,
      event: current.event || 'all',
      callbackUrl: current.callbackUrl || '',
      hasSecret: false,
      maskedSecret: null,
      active: true,
      lastTriggeredAt: null,
      createdAt: new Date(0).toISOString(),
      error: null,
    });
  };
  for (const line of lines) {
    const header = line.match(/^\s*◆\s+(.+)$/);
    if (header) {
      commit();
      current = { id: header[1].trim() };
      continue;
    }
    if (!current) continue;
    const url = line.match(/^\s*URL:\s*(.+)$/);
    const events = line.match(/^\s*Events:\s*(.*)$/);
    if (url) current.callbackUrl = url[1].trim();
    else if (events) current.event = events[1].trim() || 'all';
    else if (line.trim() && !line.includes(':') && !current.description) current.description = line.trim();
  }
  commit();
  return hooks;
}

export function parseMcpList(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s{2,}/).filter(Boolean);
    if (parts.length < 4 || parts[0] === 'Name' || parts[0].startsWith('─')) continue;
    const [name, transportRaw, , statusRaw] = parts;
    if (!/^[\w.-]+$/.test(name)) continue;
    const transport = transportRaw.startsWith('http') ? 'http' : transportRaw.startsWith('sse') ? 'sse' : 'stdio';
    rows.push({
      id: name,
      name,
      url: transportRaw,
      transport,
      enabled: /enabled|✓/i.test(statusRaw),
      maskedToken: null,
      lastTest: null,
      createdAt: new Date(0).toISOString(),
    });
  }
  return rows;
}

export function parseAuthList(text) {
  const keys = [];
  let provider = null;
  for (const line of text.split(/\r?\n/)) {
    const providerLine = line.match(/^([^\s].*?)\s+\((\d+) credentials?\):/);
    if (providerLine) {
      provider = providerLine[1].trim();
      continue;
    }
    const row = line.match(/^\s*#(\d+)\s+(.+)$/);
    if (!row || !provider) continue;
    const index = row[1];
    const rest = row[2].trim();
    const env = rest.match(/env:([A-Z0-9_]+)/)?.[0] ?? rest.split(/\s+/)[0];
    const failed = /auth failed|rate-limited|usage_limit/i.test(rest);
    keys.push({
      id: `${provider}:${index}`,
      label: `${provider} #${index}`,
      provider,
      maskedSecret: maskLabel(env),
      active: !failed,
      createdAt: new Date(0).toISOString(),
      lastRotatedAt: null,
      revokedAt: failed ? new Date(0).toISOString() : null,
      note: failed ? rest.replace(/env:[A-Z0-9_]+/g, 'env:••••') : undefined,
    });
  }
  return keys;
}

export function parseSkillsList(text) {
  const skills = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('│')) continue;
    const cols = line.split('│').map((col) => col.trim()).filter(Boolean);
    if (cols.length < 5 || cols[0] === 'Name' || cols[0].includes('━')) continue;
    const [name, category, source, trust, status] = cols;
    if (!name || name.includes('Installed Skills')) continue;
    skills.push({
      name,
      description: null,
      source: source === 'builtin' ? 'builtin' : source === 'local' ? 'user' : source === 'plugin' ? 'plugin' : 'unknown',
      enabled: /enabled/i.test(status),
      category: category || null,
      subSkillCount: null,
      lastModifiedAt: null,
      hasSensitiveAccess: /official|local/i.test(trust) && /auth|secret|credential|devops|trading|github|n8n/i.test(`${name} ${category}`),
    });
  }
  return skills;
}

export function actionResult(action, ok, message, extra = {}) {
  return { action, ok, message, completedAt: new Date().toISOString(), ...extra };
}

function unsupported(message) {
  return { unsupported: message };
}

const DEFAULT_DASHBOARD_PROXY_TARGET = 'http://127.0.0.1:9119';

export function resolveDashboardProxyTarget(options = {}) {
  return normalizeBaseUrl(
    options.dashboardBaseUrl
      ?? process.env.HERMES_DASHBOARD_PROXY_TARGET
      ?? process.env.HERMES_DASHBOARD_URL
      ?? DEFAULT_DASHBOARD_PROXY_TARGET,
  );
}

function normalizeBaseUrl(value) {
  return String(value ?? DEFAULT_DASHBOARD_PROXY_TARGET).replace(/\/+$/, '');
}

export function isKanbanProxyPath(requestPath) {
  return requestPath === '/api/plugins/kanban' || String(requestPath ?? '').startsWith('/api/plugins/kanban/');
}

export function isDashboardAuthBootstrapPath(requestPath) {
  const normalizedPath = String(requestPath ?? '');
  return (
    normalizedPath === '/login'
    || normalizedPath === '/logout'
    || normalizedPath === '/session'
    || normalizedPath === '/healthz'
    || normalizedPath === '/api/session'
    || normalizedPath === '/api/auth'
    || normalizedPath.startsWith('/api/auth/')
  );
}

export function isSensitivePlainHttpPath(requestPath) {
  const normalizedPath = String(requestPath ?? '');
  return (
    normalizedPath === '/api/pty'
    || normalizedPath.startsWith('/api/pty?')
    || normalizedPath === '/api/keys'
    || normalizedPath.startsWith('/admin')
    || isKanbanProxyPath(normalizedPath)
    || isDashboardAuthBootstrapPath(normalizedPath)
    || normalizedPath === '/config'
    || normalizedPath === '/cron'
  );
}

function getSingleHeader(req, name) {
  const value = req.get
    ? req.get(name)
    : req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function isTrustedProxySource(req, trustedProxyPeers = []) {
  if (trustedProxyPeers.length === 0) return false;

  const forwardedValue = getSingleHeader(req, 'x-forwarded-proto');
  if (!forwardedValue) return false;

  const proto = String(forwardedValue).split(',')[0].trim().toLowerCase();
  if (proto !== 'https') return false;

  const remote = normalizeIpAddress(req.socket?.remoteAddress ?? req.connection?.remoteAddress);
  return Boolean(remote && trustedProxyPeers.includes(remote));
}

export function connectionIsSecure(req, trustedProxyPeers = []) {
  if (req.secure) return true;
  if (req.socket?.encrypted) return true;
  if (isLoopbackAddress(req.socket?.remoteAddress || req.connection?.remoteAddress)) return true;
  return isTrustedProxySource(req, trustedProxyPeers);
}

export function buildSensitivePlainHttpGuard(trustedProxyPeers = []) {
  return (req, res, next) => {
    if (!isSensitivePlainHttpPath(req.path)) return next();
    if (connectionIsSecure(req, trustedProxyPeers)) return next();
    return res.status(403).json({
      error: 'Sensitive Mission Control routes are unavailable on this plain HTTP listener. Use an HTTPS reverse proxy or SSH tunnel before sending dashboard credentials, session cookies, or admin proxy tokens.',
    });
  };
}

function rejectSensitivePlainHttp(trustedProxyPeers = []) {
  return buildSensitivePlainHttpGuard(trustedProxyPeers);
}

export function buildDashboardProxyUrl({ dashboardBaseUrl, requestUrl }) {
  return new URL(requestUrl, `${normalizeBaseUrl(dashboardBaseUrl)}/`).toString();
}

function proxyRequestHeaders(req) {
  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'cookie', 'user-agent', 'x-requested-with', 'x-hermes-session-token']) {
    const value = req.header(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function proxyDashboardRequest(req, res, options = {}) {
  const targetUrl = buildDashboardProxyUrl({
    dashboardBaseUrl: options.dashboardBaseUrl,
    requestUrl: req.originalUrl ?? req.url,
  });
  const method = req.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : req.body !== undefined
      ? JSON.stringify(req.body)
      : undefined;

  try {
    const response = await (options.fetchImpl ?? fetch)(targetUrl, {
      method,
      headers: proxyRequestHeaders(req),
      body,
    });

    res.status(response.status);
    for (const [name, value] of response.headers.entries()) {
      if (['content-type', 'cache-control', 'etag', 'last-modified', 'location'].includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    }
    if (typeof response.headers.getSetCookie === 'function') {
      const setCookies = response.headers.getSetCookie();
      if (setCookies.length > 0) res.setHeader('set-cookie', setCookies);
    }

    const payload = await response.arrayBuffer();
    return res.send(Buffer.from(payload));
  } catch (error) {
    console.error('Dashboard proxy error:', error);
    return res.status(502).json({ error: sanitizeError(error.message) || 'Failed to reach Hermes dashboard target' });
  }
}

export function planKeyMcpAction(action) {
  if (action.kind === 'mcp.test') {
    const idCheck = sanitizeArg(action.id, 'id');
    if (!idCheck.valid) return unsupported(`mcp.test: ${idCheck.reason}`);
    return {
      args: ['mcp', 'test', idCheck.value],
      timeout: 40_000,
      message: `MCP server ${idCheck.value} test completed.`,
    };
  }

  if (action.kind === 'mcp.remove') {
    const idCheck = sanitizeArg(action.id, 'id');
    if (!idCheck.valid) return unsupported(`mcp.remove: ${idCheck.reason}`);
    return {
      args: ['mcp', 'remove', idCheck.value],
      timeout: 25_000,
      message: `MCP server ${idCheck.value} removed.`,
    };
  }

  if (action.kind === 'mcp.create') {
    if (action.token) {
      return unsupported('mcp.create with token is not exposed by the safe local proxy because the verified Hermes CLI path does not accept MCP tokens for HTTP/SSE entries.');
    }
    if (action.note) {
      return unsupported('mcp.create with note is not exposed by the safe local proxy because the verified Hermes CLI path does not persist MCP notes.');
    }

    const nameCheck = sanitizeArg(action.name, 'name');
    if (!nameCheck.valid) return unsupported(`mcp.create: ${nameCheck.reason}`);

    const urlCheck = sanitizeArg(action.url, 'url');
    if (!urlCheck.valid) return unsupported(`mcp.create: ${urlCheck.reason}`);

    const cleanName = nameCheck.value;
    const cleanUrl = urlCheck.value;

    const args = ['mcp', 'add', cleanName];
    if (action.transport === 'stdio') args.push('--command', cleanUrl);
    else args.push('--url', cleanUrl);

    return {
      args,
      timeout: 40_000,
      message: `MCP server ${cleanName} added.`,
      afterSuccess: async () => {
        const listed = parseMcpList(await runHermes(['mcp', 'list']));
        const matched = listed.find((entry) => entry.id === cleanName) ?? {
          id: cleanName,
          name: cleanName,
          url: cleanUrl,
          transport: action.transport,
          enabled: true,
          maskedToken: null,
          lastTest: null,
          createdAt: new Date().toISOString(),
        };
        return {
          createdMcp: {
            ...matched,
            token: null,
            rawUrl: cleanUrl,
          },
        };
      },
    };
  }

  if (action.kind === 'key.delete') {
    const [provider, ...targetParts] = String(action.id).split(':');
    const target = targetParts.join(':');
    if (!provider || !target) {
      return unsupported('key.delete requires ids in provider:index format from hermes auth list.');
    }
    const provCheck = sanitizeArg(provider, 'name');
    const tgtCheck = sanitizeArg(target, 'id');
    if (!provCheck.valid) return unsupported(`key.delete: provider ${provCheck.reason}`);
    if (!tgtCheck.valid) return unsupported(`key.delete: target ${tgtCheck.reason}`);
    return {
      args: ['auth', 'remove', provCheck.value, tgtCheck.value],
      timeout: 25_000,
      message: `Credential ${action.id} removed.`,
    };
  }

  if (action.kind === 'key.revoke') {
    return unsupported('key.revoke is not exposed by the safe local proxy because the verified Hermes CLI only supports destructive auth removal, not reversible key revocation.');
  }

  return unsupported(`${action.kind} is not exposed by the safe local proxy.`);
}

export function planCwsAction(action) {
  if (action.kind === 'cron.pause') {
    const idCheck = sanitizeArg(action.id, 'id');
    if (!idCheck.valid) return unsupported(`cron.pause: ${idCheck.reason}`);
    return { args: ['cron', 'pause', idCheck.value], timeout: 25_000, message: `Cron job ${idCheck.value} paused.` };
  }
  if (action.kind === 'cron.resume') {
    const idCheck = sanitizeArg(action.id, 'id');
    if (!idCheck.valid) return unsupported(`cron.resume: ${idCheck.reason}`);
    return { args: ['cron', 'resume', idCheck.value], timeout: 25_000, message: `Cron job ${idCheck.value} resumed.` };
  }
  if (action.kind === 'cron.run') {
    const idCheck = sanitizeArg(action.id, 'id');
    if (!idCheck.valid) return unsupported(`cron.run: ${idCheck.reason}`);
    return { args: ['cron', 'run', idCheck.value, '--accept-hooks'], timeout: 90_000, message: `Cron job ${idCheck.value} triggered.` };
  }
  if (action.kind === 'cron.remove') {
    const idCheck = sanitizeArg(action.id, 'id');
    if (!idCheck.valid) return unsupported(`cron.remove: ${idCheck.reason}`);
    return { args: ['cron', 'remove', idCheck.value], timeout: 25_000, message: `Cron job ${idCheck.value} removed.` };
  }
  if (action.kind === 'cron.create') {
    if (action.modelOverride) {
      return unsupported('cron.create with modelOverride is not exposed by the safe local proxy because the verified Hermes CLI path only supports default model execution for this surface.');
    }

    const nameCheck = sanitizeArg(action.name, 'name');
    if (!nameCheck.valid) return unsupported(`cron.create: ${nameCheck.reason}`);

    const schedCheck = sanitizeArg(action.schedule, 'schedule');
    if (!schedCheck.valid) return unsupported(`cron.create: ${schedCheck.reason}`);

    const promptCheck = sanitizeArg(action.prompt, 'safe');
    if (!promptCheck.valid) return unsupported(`cron.create: ${promptCheck.reason}`);

    const cleanName = nameCheck.value;
    const cleanSchedule = schedCheck.value;
    const cleanPrompt = promptCheck.value;

    const args = ['cron', 'create', cleanSchedule, cleanPrompt, '--name', cleanName];
    for (const skill of action.skills ?? []) {
      const skillCheck = sanitizeArg(skill, 'name');
      if (!skillCheck.valid) return unsupported(`cron.create skill "${skill}": ${skillCheck.reason}`);
      args.push('--skill', skillCheck.value);
    }
    if (action.script) {
      const scriptCheck = sanitizeArg(action.script, 'safe');
      if (!scriptCheck.valid) return unsupported(`cron.create: ${scriptCheck.reason}`);
      args.push('--script', scriptCheck.value);
    }

    return {
      args,
      timeout: 40_000,
      message: `Cron job ${cleanName} created.`,
      afterSuccess: async () => {
        const listed = parseCronList(await runHermes(['cron', 'list']));
        const matched = listed.find((job) => job.name === cleanName && job.schedule === cleanSchedule) ?? {
          id: cleanName,
          name: cleanName,
          schedule: cleanSchedule,
          enabled: true,
          paused: false,
          promptPreview: null,
          hasScript: Boolean(action.script),
          skills: action.skills ?? [],
          modelOverride: null,
          lastRunAt: null,
          nextRunAt: null,
          createdAt: new Date().toISOString(),
          error: null,
        };
        return {
          createdCron: {
            ...matched,
            fullPrompt: cleanPrompt,
            fullScript: action.script ?? null,
          },
        };
      },
    };
  }
  if (action.kind === 'webhook.remove') {
    const idCheck = sanitizeArg(action.id, 'id');
    if (!idCheck.valid) return unsupported(`webhook.remove: ${idCheck.reason}`);
    return { args: ['webhook', 'remove', idCheck.value], timeout: 25_000, message: `Webhook ${idCheck.value} removed.` };
  }
  if (action.kind === 'webhook.create') {
    return unsupported('webhook.create is not exposed by the safe local proxy yet. The verified Hermes CLI subscribes inbound webhook routes, but the current Mission Control UI still sends callbackUrl semantics that do not match that contract.');
  }
  if (action.kind === 'skill.enable' || action.kind === 'skill.disable') {
    return unsupported(`${action.kind} is not exposed by the safe local proxy because the verified Hermes CLI only offers interactive skills config, not a stable non-interactive enable/disable command.`);
  }

  return unsupported(`${action.kind} is not exposed by the safe local proxy.`);
}

async function executePlannedAction(action, planner) {
  const plan = planner(action);
  if (plan.unsupported) {
    return { status: 501, body: actionResult(action, false, plan.unsupported) };
  }

  await runHermes(plan.args, plan.timeout);
  const extra = typeof plan.afterSuccess === 'function' ? await plan.afterSuccess() : {};
  return { status: 200, body: actionResult(action, true, plan.message, extra) };
}

export function createMissionControlProxyApp(options = {}) {
  const app = express();
  const auth = resolveProxyAuthConfig({
    apiKey: options.apiKey ?? process.env.MISSION_CONTROL_ADMIN_PROXY_KEY ?? '',
    authMode: options.authMode ?? process.env.MISSION_CONTROL_PROXY_AUTH_MODE ?? '',
  });
  const corsOrigins = parseCorsOriginList(options.corsOrigin ?? process.env.MISSION_CONTROL_CORS_ORIGIN ?? '');
  const trustedProxyPeers = parseTrustedProxyPeers(options.trustedProxyPeers ?? process.env.MISSION_CONTROL_TRUSTED_PROXY_PEERS ?? '');
  const distDir = options.distDir ?? path.join(__dirname, 'dist');
  const dashboardBaseUrl = resolveDashboardProxyTarget({ dashboardBaseUrl: options.dashboardBaseUrl });
  const dashboardFetch = options.fetchImpl ?? fetch;
  const requireSecureTransport = resolveRequireSecureTransport(options.requireSecureTransport);


  app.use(bodyParser.json({ limit: '256kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.removeHeader('X-Powered-By');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:3187 wss://127.0.0.1:3443 http://127.0.0.1:3187 https://127.0.0.1:3443; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'"
    );
    next();
  });
  app.use((req, res, next) => {
    const allowedOrigin = resolveCorsOrigin({
      requestOrigin: req.header('Origin') ?? null,
      requestHost: req.headers.host ?? '',
      configuredOrigins: corsOrigins,
    });
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Mission-Control-Key,X-Hermes-Session-Token');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  if (requireSecureTransport) {
    app.use(rejectSensitivePlainHttp(trustedProxyPeers));
  }
  app.use((req, res, next) => {
    if (
      isAdminProxyRequestAuthorized({
        path: req.path,
        providedToken: req.header('X-Mission-Control-Key') ?? null,
        auth,
      })
    ) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
  });

  // ── Rate limiter for admin routes ───────────────────────────────────
  const rateLimitStore = new Map();
  const RATE_LIMIT_WINDOW = 60_000; // 1 minute
  const RATE_LIMIT_MAX = 30; // 30 requests per window per IP

  function rateLimit(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitStore.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + RATE_LIMIT_WINDOW;
    } else {
      entry.count++;
    }
    rateLimitStore.set(ip, entry);

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - entry.count));

    if (entry.count > RATE_LIMIT_MAX) {
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }
    next();
  }

  // Periodic cleanup of old rate limit entries
  const rateLimitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitStore) {
      if (now > entry.resetAt + RATE_LIMIT_WINDOW) {
        rateLimitStore.delete(ip);
      }
    }
  }, 300_000); // every 5 minutes
  // Allow the timer to not keep the process alive
  if (rateLimitCleanup.unref) rateLimitCleanup.unref();

  // Apply rate limiter BEFORE admin routes
  app.use('/admin', rateLimit);

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'sora-mission-control-admin-proxy' }));
  app.get('/admin/keys', async (_req, res) => {
    try {
      res.json({ keys: parseAuthList(await runHermes(['auth', 'list'])) });
    } catch (error) {
      console.error('Admin GET /admin/keys error:', error);
      res.status(500).json({ error: sanitizeError(error.message) });
    }
  });
  app.get('/admin/mcp', async (_req, res) => {
    try {
      res.json({ mcpEntries: parseMcpList(await runHermes(['mcp', 'list'])) });
    } catch (error) {
      console.error('Admin GET /admin/mcp error:', error);
      res.status(500).json({ error: sanitizeError(error.message) });
    }
  });
  app.get('/admin/cron', async (_req, res) => {
    try {
      res.json({ cronJobs: parseCronList(await runHermes(['cron', 'list'])) });
    } catch (error) {
      console.error('Admin GET /admin/cron error:', error);
      res.status(500).json({ error: sanitizeError(error.message) });
    }
  });
  app.get('/admin/webhooks', async (_req, res) => {
    try {
      const output = await runHermes(['webhook', 'list']);
      if (shouldTreatWebhookListAsUnavailable(output)) {
        return res.status(503).json({
          error: 'Hermes webhook platform is not enabled for this profile. Enable gateway webhooks before using Mission Control webhook admin.',
        });
      }
      return res.json({ webhooks: parseWebhookList(output) });
    } catch (error) {
      console.error('Admin GET /admin/webhooks error:', error);
      return res.status(500).json({ error: sanitizeError(error.message) });
    }
  });
  app.get('/admin/skills', async (_req, res) => {
    try {
      res.json({ skills: parseSkillsList(await runHermes(['skills', 'list', '--source', 'all'], 40_000)) });
    } catch (error) {
      console.error('Admin GET /admin/skills error:', error);
      res.status(500).json({ error: sanitizeError(error.message) });
    }
  });

  // ── Calendar events from cron schedule ───────────────────────────────
  app.get('/admin/calendar/events', async (_req, res) => {
    try {
      // Fetch cron jobs as the most immediately available time-based data
      const cronOutput = await runHermes(['cron', 'list']);
      const cronJobs = parseCronList(cronOutput);

      // Convert cron jobs to calendar events
      const events = cronJobs
        .filter(job => job.schedule && job.schedule !== 'unknown')
        .map(job => {
          const ts = job.nextRunAt || job.createdAt;
          return {
            timestamp: ts,
            eventType: 'scheduled',
            title: job.name || job.id,
            urgency: job.paused ? 'upcoming' : 'soon',
            status: job.paused ? 'tentative' : 'confirmed',
            freshness: 'live',
          };
        });

      const warnings = [];
      if (cronJobs.length === 0) {
        warnings.push('No scheduled cron jobs found — calendar may be empty.');
      }

      res.json({
        events,
        warnings,
        freshness: 'live',
        source: 'hermes-cron',
      });
    } catch (error) {
      console.error('Admin GET /admin/calendar/events error:', error);
      // Return available data even if partial
      res.json({
        events: [],
        warnings: ['Calendar backend unavailable — events may be incomplete'],
        freshness: 'degraded',
        source: 'hermes-cron',
      });
    }
  });

  app.post('/admin/keymcp/actions', async (req, res) => {
    const action = req.body?.action;
    if (!action?.kind) return res.status(400).json({ error: 'Missing action.kind' });
    try {
      const result = await executePlannedAction(action, planKeyMcpAction);
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error('Admin POST /admin/keymcp/actions error:', error);
      return res.status(500).json(actionResult(action, false, sanitizeError(error.message)));
    }
  });

  app.post('/admin/cws/actions', async (req, res) => {
    const action = req.body?.action;
    if (!action?.kind) return res.status(400).json({ error: 'Missing action.kind' });
    try {
      const result = await executePlannedAction(action, planCwsAction);
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error('Admin POST /admin/cws/actions error:', error);
      return res.status(500).json(actionResult(action, false, sanitizeError(error.message)));
    }
  });

  app.all(/^\/api\/plugins\/kanban(?:\/.*)?$/, async (req, res) => {
    return proxyDashboardRequest(req, res, {
      dashboardBaseUrl,
      fetchImpl: dashboardFetch,
    });
  });

  app.all(['/login', '/logout', '/session', '/healthz', '/api/session'], async (req, res) => {
    return proxyDashboardRequest(req, res, {
      dashboardBaseUrl,
      fetchImpl: dashboardFetch,
    });
  });
  app.all(/^\/api\/auth(?:\/.*)?$/, async (req, res) => {
    return proxyDashboardRequest(req, res, {
      dashboardBaseUrl,
      fetchImpl: dashboardFetch,
    });
  });

  app.use(express.static(distDir));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

  return app;
}

function bindWebSocketUpgrade(server, dashboardBaseUrl, blockUnsecured, trustedProxyPeers = []) {
  server.on('upgrade', (req, socket, head) => {
    // Proxy ALL WebSocket paths through this server, not just /api/pty.
    // This lets Kanban WS events (/api/plugins/kanban/events) flow through
    // the same HTTPS tunnel, keeping the WS encrypted and same-origin.
    if (!req.url || (!req.url.startsWith('/api/pty') && !req.url.startsWith('/api/plugins/kanban/events'))) {
      socket.destroy();
      return;
    }
    const isSecureConnection = connectionIsSecure(req, trustedProxyPeers);
    if (blockUnsecured && !isSecureConnection) {
      socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{"error":"Sensitive Mission Control routes are unavailable on this plain HTTP listener."}');
      socket.destroy();
      return;
    }

    let targetHost;
    let targetPort;
    let targetPath;
    try {
      const parsed = new URL(dashboardBaseUrl);
      targetHost = parsed.hostname || '127.0.0.1';
      targetPort = Number(parsed.port) || 9119;
      // Preserve the original path + query string
      const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      targetPath = reqUrl.pathname + reqUrl.search;
    } catch {
      targetHost = '127.0.0.1';
      targetPort = 9119;
      targetPath = req.url;
    }

    const targetSocket = net.connect(targetPort, targetHost, () => {
      // Build the upgrade request to forward to the Hermes dashboard
      const upgradeReq = [
        `GET ${targetPath} HTTP/1.1`,
        `Host: ${targetHost}:${targetPort}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
      ];

      // Forward original WebSocket headers
      const wsKey = req.headers['sec-websocket-key'];
      const wsVersion = req.headers['sec-websocket-version'];
      const wsProtocol = req.headers['sec-websocket-protocol'];
      const wsExtensions = req.headers['sec-websocket-extensions'];

      if (wsKey) upgradeReq.push(`Sec-WebSocket-Key: ${wsKey}`);
      if (wsVersion) upgradeReq.push(`Sec-WebSocket-Version: ${wsVersion}`);
      if (wsProtocol) upgradeReq.push(`Sec-WebSocket-Protocol: ${wsProtocol}`);
      if (wsExtensions) upgradeReq.push(`Sec-WebSocket-Extensions: ${wsExtensions}`);

      // Forward session token from original request if present
      const sessionToken = req.headers['x-hermes-session-token']
        ?? req.url.match(/[?&]token=([^&]+)/)?.[1];
      if (sessionToken) {
        upgradeReq.push(`X-Hermes-Session-Token: ${sessionToken}`);
      }

      upgradeReq.push('', '');

      targetSocket.write(upgradeReq.join('\r\n'));
      targetSocket.write(head);
      targetSocket.pipe(socket);
      socket.pipe(targetSocket);
    });

    targetSocket.on('error', () => {
      socket.destroy();
    });

    socket.on('error', () => {
      targetSocket.destroy();
    });
  });
}

export function startMissionControlProxy(options = {}) {
  const app = createMissionControlProxyApp(options);
  const port = Number(options.port ?? process.env.MISSION_CONTROL_PROXY_PORT ?? DEFAULT_PROXY_PORT);
  const host = options.host ?? process.env.MISSION_CONTROL_PROXY_HOST ?? DEFAULT_PROXY_HOST;
  const dashboardBaseUrl = resolveDashboardProxyTarget({ dashboardBaseUrl: options.dashboardBaseUrl });
  const requireSecureTransport = resolveRequireSecureTransport(options.requireSecureTransport);
  const trustedProxyPeers = parseTrustedProxyPeers(options.trustedProxyPeers ?? process.env.MISSION_CONTROL_TRUSTED_PROXY_PEERS ?? '');

  const tlsCertPath = options.tlsCert ?? process.env.MISSION_CONTROL_TLS_CERT ?? '';
  const tlsKeyPath = options.tlsKey ?? process.env.MISSION_CONTROL_TLS_KEY ?? '';
  const tlsPort = Number(options.tlsPort ?? process.env.MISSION_CONTROL_TLS_PORT ?? 3443);

  let httpServer;
  let httpsServer;

  // Start HTTPS server if TLS cert and key are both available
  if (tlsCertPath && tlsKeyPath && fs.existsSync(tlsCertPath) && fs.existsSync(tlsKeyPath)) {
    const tlsOptions = {
      cert: fs.readFileSync(tlsCertPath),
      key: fs.readFileSync(tlsKeyPath),
    };
    httpsServer = https.createServer(tlsOptions, app);
    httpsServer.listen(tlsPort, host, () => {
      console.log(`Hermes Dashboard admin proxy (HTTPS) listening at https://${host}:${tlsPort}`);
    });
    // WebSocket upgrades on HTTPS are always secure (TLS-wrapped)
    bindWebSocketUpgrade(httpsServer, dashboardBaseUrl, false, trustedProxyPeers);
  }

  // Always start HTTP server for SPA + health (sensitive routes blocked by requireSecureTransport middleware)
  httpServer = app.listen(port, host, () => {
    console.log(`Hermes Dashboard admin proxy listening at http://${host}:${port}`);
  });
  bindWebSocketUpgrade(httpServer, dashboardBaseUrl, requireSecureTransport, trustedProxyPeers);

  return { httpServer, httpsServer };
}

export function isDirectExecution(metaUrl = import.meta.url, argvPath = process.argv[1]) {
  if (!argvPath) return false;
  return metaUrl === pathToFileURL(path.resolve(argvPath)).href;
}

if (isDirectExecution()) {
  startMissionControlProxy();
}
