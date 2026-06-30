/**
 * Provenance types — source tracking, freshness, and confidence metadata.
 *
 * Every data item exposed to UI MUST carry provenance so consumers can
 * distinguish remote (Hermes dashboard API) data from local runtime data,
 * and so the UI can render unknown states honestly instead of faking live.
 *
 * See docs/section-contracts.md §Global rules #4: "Every data item exposed
 * to UI carries `source`, `freshness`, and `confidence` when uncertainty
 * exists."
 */

/**
 * Where a piece of data originated. Discriminates remote vs local sources
 * without ambiguity. Adapters tag every normalized value with one of these.
 */
export type DataSource =
  | 'dashboard-api' // Hermes dashboard REST (e.g. /api/plugins/kanban/board)
  | 'kanban-ws' // Hermes Kanban live WS stream (/api/plugins/kanban/events)
  | 'profile-cli' // `hermes profile list/show` via trusted local proxy
  | 'usage-cli' // `hermes insights` historical usage
  | 'admin-cli' // `hermes cron/webhook/skills/mcp/auth` CLI surfaces
  | 'provider-rate-limits' // Provider API rate-limit headers or bridge responses
  | 'local-runtime' // In-process derived/computed state (FSM activity, FPS)
  | 'mock' // Dev/test MSW mock data — MUST surface as demo, never as live
  | 'unknown'; // Source could not be determined — render as unknown, not green

/**
 * Staleness bucket. Adapters compute this from the last-known timestamp.
 * UI uses it to fade/strike stale values and to decide whether to show a
 * "refreshing" affordance.
 */
export type Freshness =
  | 'live' // Updated within the active poll/WS window (<= freshnessThresholdMs)
  | 'fresh' // Recent but not live (< stale-after window)
  | 'stale' // Older than fresh window but still considered present
  | 'missing'; // Never received, or invalidated by reconnect/auth loss

/**
 * How much trust to place in a value. Drives UI confidence affordances
 * (e.g. faded text, "unverified" badge). Distinct from connection health:
 * a source can be connected but return partial/unverified data.
 */
export type Confidence =
  | 'verified' // Confirmed against real Hermes runtime (Phase 0 verified surfaces)
  | 'inferred' // Derived/computed from verified data but not directly observed
  | 'unverified' // Endpoint exists but data has not been confirmed in this runtime
  | 'placeholder' // Stand-in until real data is wired — renders as 'unknown'
  | 'unknown'; // No basis to assign confidence — render as unknown

/**
 * Canonical provenance envelope. Wrap any normalized value with this so
 * downstream consumers always know where it came from and how stale it is.
 *
 * Invariants:
 *  - `source` is always set; never omit it. Use 'unknown' rather than
 *    leaving it undefined.
 *  - `freshness` defaults to 'missing' until the adapter emits the first
 *    real value; UI must not assume 'live'.
 *  - `confidence` is 'verified' only for Phase-0-verified surfaces; new or
 *    unconfirmed endpoints start at 'unverified'.
 *  - `receivedAt` is an ISO 8601 string set by the adapter at normalization
 *    time, not the upstream timestamp.
 */
export interface Provenance {
  source: DataSource;
  freshness: Freshness;
  confidence: Confidence;
  /** ISO 8601 timestamp when the adapter normalized this value. */
  receivedAt: string;
  /** Optional human-readable note for partial/error states. */
  note?: string;
}

/**
 * A value paired with its provenance. The canonical shape every store
 * selector returns when uncertainty exists.
 */
export interface Tracked<T> {
  value: T | null;
  provenance: Provenance;
}

/**
 * Helper for adapters to construct a Tracked envelope.
 * Defaults freshness to 'missing' and confidence to 'unknown' so callers
 * must consciously upgrade them — never silently assume live/verified.
 */
export function tracked<T>(
  value: T | null,
  partial: Partial<Provenance> & { source: DataSource },
): Tracked<T> {
  return {
    value,
    provenance: {
      source: partial.source,
      freshness: partial.freshness ?? 'missing',
      confidence: partial.confidence ?? 'unknown',
      receivedAt: partial.receivedAt ?? new Date().toISOString(),
      note: partial.note,
    },
  };
}