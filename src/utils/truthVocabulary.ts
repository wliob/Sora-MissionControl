/**
 * Truth vocabulary display helpers.
 *
 * Internal provenance enums include engineering buckets such as `fresh`,
 * `missing`, `unverified`, and `placeholder`. User-facing chrome must map
 * those to the approved Mission Control truth vocabulary:
 * verified, live, stale, degraded, unknown, unavailable.
 */

export interface TruthProvenanceLike {
  source?: string;
  freshness?: string;
  confidence?: string;
}

export function truthFreshnessLabel(value: string | null | undefined): string {
  switch (value) {
    case 'live':
    case 'stale':
    case 'degraded':
    case 'unavailable':
    case 'unknown':
      return value;
    case 'fresh':
      return 'live';
    case 'missing':
    default:
      return 'unknown';
  }
}

export function truthConfidenceLabel(value: string | null | undefined): string {
  switch (value) {
    case 'verified':
      return 'verified';
    case 'placeholder':
      return 'unknown';
    case 'unknown':
      return 'unknown';
    case 'inferred':
    case 'unverified':
    default:
      return 'unknown';
  }
}

export function truthProvenanceLabel(provenance: TruthProvenanceLike): string {
  const source = provenance.source ?? 'unknown';
  return `${source} • ${truthFreshnessLabel(provenance.freshness)}/${truthConfidenceLabel(provenance.confidence)}`;
}
