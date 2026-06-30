/**
 * chatBackbone — Phase 4 composition seam for the chat module.
 *
 * Binds a `ChatTransport` into the `chatStore` and bridges the shared profile
 * roster into the chat profile context. This is the only place that knows
 * which concrete transport is active (demo mock vs. Cloud's verified adapter)
 * — the store and UI depend only on the `ChatTransport` interface.
 *
 * Responsibilities:
 *   1. Pick a transport: a supplied transport first, else the real Hermes PTY
 *      transport when a dashboard client is available, else the explicit demo
 *      mock (`createDemoChatTransport`) for isolated tests/offline shells.
 *      `isDemoMode()` remains available for diagnostics/backward compatibility.
 *   2. Bind it to the chat store (`setTransport`).
 *   3. Bridge the profile roster: call `transport.listProfiles()`, map to
 *      `ChatProfileContext`, and push into `setProfiles`. The chat module
 *      consumes the roster rather than enumerating its own (per the forbidden
 *      dependency "No independent profile roster").
 *   4. Report `chat-transport` source health to the shared
 *      `sessionConnectionStore` so the connection panel and overall rollup
 *      reflect the chat transport honestly (connected / degraded / offline).
 *
 * Forbidden here (same as the chat module contract):
 *   - No CLI spawning, no secret access, no consumer styling.
 *
 * Lifecycle: `startChatBackbone()` is called once at app boot (after the
 * session/connection backbone). `stopChatBackbone()` unbinds the transport
 * and clears chat profile context.
 */

import { AGENTS } from '@/types';
import type { AgentId } from '@/types';
import { setProfiles, setTransport } from './chatStore';
import type { ChatProfileContext, ChatTransport } from './types';
import { createDemoChatTransport } from './demoChatTransport';
import { HermesChatTransport } from './hermesChatTransport';
import { HermesDashboardClient } from '@/services/hermes/dashboardClient';
import {
  updateSourceHealth,
} from '@/state/sessionConnectionStore';
import type { SourceHealth } from '@/types/connection';

/** Whether the active chat transport is the fallback demo mock. */
let demoMode = true;

/** Accents for the 5 department leads, used to build ChatProfileContext. */
const ACCENTS: Record<AgentId, string> = AGENTS.reduce(
  (acc, a) => {
    acc[a.id] = a.accent;
    return acc;
  },
  {} as Record<AgentId, string>,
);

export interface ChatBackboneOptions {
  /**
   * A Cloud-verified transport, if available. When omitted (or null), the
   * explicit demo mock is used. Passing a verified transport here is the
   * single swap point when Cloud lands a real adapter.
   */
  transport?: ChatTransport | null;
  dashboardClient?: HermesDashboardClient;
}

/**
 * Map a transport-supplied profile summary (id/name/role) into the chat
 * profile context the store consumes. Accents come from the static AGENTS
 * roster so unknown/custom profiles fall back to a neutral accent.
 */
function toChatProfileContext(
  id: string,
  name: string,
  role: string,
): ChatProfileContext {
  const isKnown = (AGENTS as ReadonlyArray<{ id: AgentId }>).some(
    (a) => a.id === id,
  );
  const accent = isKnown ? ACCENTS[id as AgentId] : 'var(--text-muted)';
  return {
    id: id as AgentId,
    name,
    role,
    accent,
    connection: 'unknown',
  };
}

/**
 * Fetch the profile roster from the transport and push it into the chat store.
 * Falls back to the static AGENTS roster if the transport's listProfiles
 * rejects or returns empty — so the chat surface never goes blank, but the
 * transport source health is marked degraded so the UI shows it honestly.
 */
async function bridgeProfiles(transport: ChatTransport): Promise<void> {
  // Start from the full static roster floor so every department lead has a
  // profile context entry even before the transport responds. Transport
  // summaries then enrich/override. This keeps the type a full
  // Record<AgentId, ChatProfileContext> and the profile rail never blank.
  const profiles = {} as Record<AgentId, ChatProfileContext>;
  for (const a of AGENTS) {
    profiles[a.id] = toChatProfileContext(a.id, a.name, a.role);
  }
  try {
    const summaries = await transport.listProfiles();
    if (!summaries.length) throw new Error('transport returned no profiles');
    for (const s of summaries) {
      profiles[s.id as AgentId] = toChatProfileContext(s.id, s.name, s.role);
    }
    updateChatHealth('connected');
  } catch {
    // Keep the static roster floor; mark the transport degraded.
    updateChatHealth('degraded', 'transport listProfiles failed; using static roster');
  }
  setProfiles(profiles);
}

function updateChatHealth(state: SourceHealth['state'], error?: string): void {
  const checkedAt = new Date().toISOString();
  updateSourceHealth('chat-transport', {
    state,
    lastOkAt: state === 'connected' ? checkedAt : null,
    lastCheckedAt: checkedAt,
    ...(error ? { error } : {}),
  });
}

export interface ChatBackbone {
  /** The bound transport (the store holds its own reference too). */
  transport: ChatTransport;
  /** True when the demo mock is active. */
  isDemoMode(): boolean;
  /** Re-bridge the profile roster from the transport. */
  refreshProfiles(): Promise<void>;
  /** Unbind the transport and clear chat profile context. */
  stop(): void;
}

let chatBackbone: ChatBackbone | null = null;

/**
 * Start the chat backbone. Binds a transport (verified or demo) and bridges
 * the profile roster. Safe to call once at app boot; calling again first
 * stops the previous backbone.
 */
export function startChatBackbone(
  options: ChatBackboneOptions = {},
): ChatBackbone {
  chatBackbone?.stop();

  const transport = options.transport ?? (options.dashboardClient && HermesChatTransport.isAvailable() ? new HermesChatTransport(options.dashboardClient) : createDemoChatTransport());
  demoMode = options.transport == null && !(options.dashboardClient && HermesChatTransport.isAvailable());

  setTransport(transport);

  // Bridge profiles asynchronously. The store is usable immediately (an
  // empty roster renders an empty profile rail); the roster lands shortly.
  void bridgeProfiles(transport);

  const backbone: ChatBackbone = {
    transport,
    isDemoMode: () => demoMode,
    refreshProfiles: () => bridgeProfiles(transport),
    stop: stopChatBackbone,
  };
  chatBackbone = backbone;
  return backbone;
}

/** Unbind the transport and clear chat profile context. */
export function stopChatBackbone(): void {
  setTransport(null);
  setProfiles({} as Record<AgentId, ChatProfileContext>);
  demoMode = true;
  chatBackbone = null;
  updateChatHealth('offline', 'chat backbone stopped');
}

/** The currently active chat backbone, or null if not started. */
export function getChatBackbone(): ChatBackbone | null {
  return chatBackbone;
}

/** Whether the demo mock transport is active. */
export function isDemoMode(): boolean {
  return demoMode;
}