/**
 * Unit tests for the Phase 8 WebGL fallback chain + error message (#15).
 *
 * The detection logic is a pure function over the PixiJS RendererType enum
 * value — no PIXI Application, no DOM — so we can drive every branch
 * deterministically. This mirrors the perfMode.ts pure-function test pattern.
 *
 * Contract:
 *   - RendererType.WEBGL (1)  → available, no error
 *   - RendererType.WEBGPU (2) → available, no error (WebGPU supersedes WebGL)
 *   - RendererType.BOTH (3)   → available, no error (WEBGL | WEBGPU bitwise)
 *   - RendererType.CANVAS (4)  → WebGL unavailable, throw descriptive error
 *   - unknown / unexpected     → WebGL unavailable, throw descriptive error
 */
import { describe, expect, it } from 'vitest';
import {
  checkWebGLAvailability,
  WEBGL_UNAVAILABLE_MESSAGE,
  WEBGL_COMPATIBILITY_URL,
  WebGLUnavailableError,
  isWebGLUnavailableError,
  RENDERER_TYPE_CANVAS,
  RENDERER_TYPE_WEBGL,
  RENDERER_TYPE_WEBGPU,
} from '@/office/engine/webglDetector';

describe('webglDetector — WebGL available (no error)', () => {
  it('returns null (no error) when renderer type is WEBGL', () => {
    expect(checkWebGLAvailability(RENDERER_TYPE_WEBGL)).toBeNull();
  });

  it('returns null (no error) when renderer type is WEBGPU', () => {
    expect(checkWebGLAvailability(RENDERER_TYPE_WEBGPU)).toBeNull();
  });

  it('returns null (no error) when renderer type is BOTH (WEBGL | WEBGPU)', () => {
    expect(checkWebGLAvailability(RENDERER_TYPE_WEBGL | RENDERER_TYPE_WEBGPU)).toBeNull();
  });
});

describe('webglDetector — WebGL unavailable (Canvas2D fallback detected)', () => {
  it('returns a WebGLUnavailableError when renderer type is CANVAS', () => {
    const result = checkWebGLAvailability(RENDERER_TYPE_CANVAS);
    expect(result).toBeInstanceOf(WebGLUnavailableError);
  });

  it('the error message includes "WebGL unavailable"', () => {
    const result = checkWebGLAvailability(RENDERER_TYPE_CANVAS);
    expect(result?.message).toContain('WebGL unavailable');
  });

  it('the error includes the browser compatibility URL', () => {
    const result = checkWebGLAvailability(RENDERER_TYPE_CANVAS);
    expect(result?.message).toContain(WEBGL_COMPATIBILITY_URL);
  });

  it('the error message mentions Canvas2D fallback was rejected', () => {
    const result = checkWebGLAvailability(RENDERER_TYPE_CANVAS);
    expect(result?.message.toLowerCase()).toContain('canvas');
  });
});

describe('webglDetector — unknown renderer type', () => {
  it('returns a WebGLUnavailableError for an unknown renderer type (0)', () => {
    const result = checkWebGLAvailability(0);
    expect(result).toBeInstanceOf(WebGLUnavailableError);
  });

  it('returns a WebGLUnavailableError for an unexpected renderer type (99)', () => {
    const result = checkWebGLAvailability(99);
    expect(result).toBeInstanceOf(WebGLUnavailableError);
  });

  it('returns a WebGLUnavailableError for a negative renderer type', () => {
    const result = checkWebGLAvailability(-1);
    expect(result).toBeInstanceOf(WebGLUnavailableError);
  });
});

describe('WebGLUnavailableError — structured error', () => {
  it('is an instance of Error', () => {
    const err = new WebGLUnavailableError();
    expect(err).toBeInstanceOf(Error);
  });

  it('has a name of "WebGLUnavailableError"', () => {
    const err = new WebGLUnavailableError();
    expect(err.name).toBe('WebGLUnavailableError');
  });

  it('exposes the compatibility URL as a static property', () => {
    expect(WebGLUnavailableError.compatibilityUrl).toBe(WEBGL_COMPATIBILITY_URL);
  });

  it('exposes the canonical message as a constant', () => {
    expect(WEBGL_UNAVAILABLE_MESSAGE).toContain('WebGL unavailable');
    expect(WEBGL_UNAVAILABLE_MESSAGE).toContain(WEBGL_COMPATIBILITY_URL);
  });

  it('the error message matches the canonical message constant', () => {
    const err = new WebGLUnavailableError();
    expect(err.message).toBe(WEBGL_UNAVAILABLE_MESSAGE);
  });
});

describe('webglDetector — isWebGLUnavailableError helper', () => {
  it('returns true for a WebGLUnavailableError instance', () => {
    const err = new WebGLUnavailableError();
    expect(isWebGLUnavailableError(err)).toBe(true);
  });

  it('returns true for a WebGLUnavailableError thrown and caught', () => {
    try {
      throw new WebGLUnavailableError();
    } catch (e) {
      expect(isWebGLUnavailableError(e)).toBe(true);
    }
  });

  it('returns false for a generic Error', () => {
    const err = new Error('something else');
    expect(isWebGLUnavailableError(err)).toBe(false);
  });

  it('returns false for a non-Error value', () => {
    expect(isWebGLUnavailableError('string')).toBe(false);
    expect(isWebGLUnavailableError(null)).toBe(false);
    expect(isWebGLUnavailableError(undefined)).toBe(false);
  });
});