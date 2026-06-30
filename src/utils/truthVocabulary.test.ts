import { describe, expect, it } from 'vitest';
import {
  truthFreshnessLabel,
  truthConfidenceLabel,
  truthProvenanceLabel,
} from '@/utils/truthVocabulary';
import type { TruthProvenanceLike } from '@/utils/truthVocabulary';

describe('Truth vocabulary', () => {
  describe('truthFreshnessLabel', () => {
    it('returns live for fresh', () => {
      expect(truthFreshnessLabel('fresh')).toBe('live');
    });

    it('returns unknown for missing', () => {
      expect(truthFreshnessLabel('missing')).toBe('unknown');
    });

    it('returns unknown for null/undefined', () => {
      expect(truthFreshnessLabel(null)).toBe('unknown');
      expect(truthFreshnessLabel(undefined)).toBe('unknown');
    });

    it('passes through approved labels unchanged', () => {
      expect(truthFreshnessLabel('live')).toBe('live');
      expect(truthFreshnessLabel('stale')).toBe('stale');
      expect(truthFreshnessLabel('degraded')).toBe('degraded');
      expect(truthFreshnessLabel('unavailable')).toBe('unavailable');
      expect(truthFreshnessLabel('unknown')).toBe('unknown');
    });

    it('returns unknown for unrecognized values', () => {
      expect(truthFreshnessLabel('anything-else')).toBe('unknown');
      expect(truthFreshnessLabel('mock')).toBe('unknown');
      expect(truthFreshnessLabel('demo')).toBe('unknown');
    });
  });

  describe('truthConfidenceLabel', () => {
    it('returns verified for verified', () => {
      expect(truthConfidenceLabel('verified')).toBe('verified');
    });

    it('returns unknown for placeholder (not mock/demo)', () => {
      expect(truthConfidenceLabel('placeholder')).toBe('unknown');
    });

    it('returns unknown for unverified', () => {
      expect(truthConfidenceLabel('unverified')).toBe('unknown');
    });

    it('returns unknown for inferred', () => {
      expect(truthConfidenceLabel('inferred')).toBe('unknown');
    });

    it('returns unknown for unknown', () => {
      expect(truthConfidenceLabel('unknown')).toBe('unknown');
    });

    it('returns unknown for null/undefined', () => {
      expect(truthConfidenceLabel(null)).toBe('unknown');
      expect(truthConfidenceLabel(undefined)).toBe('unknown');
    });

    it('returns unknown for unrecognized values', () => {
      expect(truthConfidenceLabel('mock')).toBe('unknown');
      expect(truthConfidenceLabel('demo')).toBe('unknown');
      expect(truthConfidenceLabel('anything')).toBe('unknown');
    });
  });

  describe('truthProvenanceLabel', () => {
    it('combines source, freshness, and confidence', () => {
      const provenance: TruthProvenanceLike = {
        source: 'dashboard-api',
        freshness: 'live',
        confidence: 'verified',
      };
      expect(truthProvenanceLabel(provenance)).toBe('dashboard-api • live/verified');
    });

    it('defaults source to unknown when missing', () => {
      const provenance: TruthProvenanceLike = {
        freshness: 'live',
      };
      expect(truthProvenanceLabel(provenance)).toBe('unknown • live/unknown');
    });

    it('handles placeholder confidence as unknown', () => {
      const provenance: TruthProvenanceLike = {
        source: 'admin-cli',
        freshness: 'fresh',
        confidence: 'placeholder',
      };
      expect(truthProvenanceLabel(provenance)).toBe('admin-cli • live/unknown');
    });
  });
});
