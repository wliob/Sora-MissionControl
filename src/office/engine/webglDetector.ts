/**
 * Phase 8 WebGL fallback chain + error message (#15).
 *
 * PixiJS v8 prefers WebGL2, falls back to WebGL1, and if both fail silently
 * falls back to a Canvas2D renderer. The Canvas2D path is a degraded mode
 * for this scene — it cannot render the isometric spritesheets, depth
 * sorting, or filters the office relies on — so falling back silently
 * produces a broken-looking canvas with no explanation.
 *
 * This module provides the pure detection logic: given the PixiJS
 * `renderer.type` enum value (RendererType), determine whether WebGL (or
 * the superseding WebGPU) is available. If not, return a structured
 * `WebGLUnavailableError` with a clear message and a browser-compatibility
 * link so the OfficeCanvas / OfficeErrorBoundary UI can surface it.
 *
 * The function is pure (no PIXI, no DOM) so it is unit-testable in the node
 * test environment — same pattern as perfMode.ts.
 */

/**
 * PixiJS RendererType enum values (from pixi.js/lib/rendering/renderers/types).
 * Mirrored here as constants so the detection logic is testable without
 * importing PIXI (which needs a WebGL/DOM environment).
 *
 *   WEBGL  = 1
 *   WEBGPU = 2
 *   CANVAS = 4
 *   BOTH   = 3  (WEBGL | WEBGPU)
 */
export const RENDERER_TYPE_WEBGL = 1;
export const RENDERER_TYPE_WEBGPU = 2;
export const RENDERER_TYPE_CANVAS = 4;

/**
 * Browser compatibility URL. Points to a help page listing supported
 * browsers and common WebGL enablement steps (driver updates, about:flags
 * hardware acceleration toggle, etc.).
 */
export const WEBGL_COMPATIBILITY_URL = 'https://get.webgl.org/';

/**
 * Canonical error message shown when WebGL is unavailable.
 */
export const WEBGL_UNAVAILABLE_MESSAGE =
  'WebGL unavailable: your browser could not initialise a WebGL context ' +
  'and the Canvas2D fallback is not supported for the 3D office. ' +
  'Please update your graphics drivers or enable hardware acceleration. ' +
  `Browser compatibility: ${WEBGL_COMPATIBILITY_URL}`;

/**
 * Structured error thrown / returned when WebGL is not available.
 *
 * Carries the compatibility URL as a static property so the UI can render
 * it as a clickable link without parsing the message string.
 */
export class WebGLUnavailableError extends Error {
  /** Browser compatibility help page. */
  static readonly compatibilityUrl: string = WEBGL_COMPATIBILITY_URL;

  constructor(message: string = WEBGL_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = 'WebGLUnavailableError';
    // Restore prototype chain for ES5 transpilation targets.
    Object.setPrototypeOf(this, WebGLUnavailableError.prototype);
  }
}

/**
 * Check whether the given PixiJS renderer type indicates that WebGL (or
 * WebGPU) is available. Returns `null` when a GPU renderer is present, or
 * a `WebGLUnavailableError` when the renderer fell back to Canvas2D or the
 * type is unknown / unexpected.
 *
 * @param rendererType - The numeric `app.renderer.type` from PixiJS after init.
 * @returns `null` if WebGL/WebGPU is available, else a `WebGLUnavailableError`.
 */
export function checkWebGLAvailability(rendererType: number): WebGLUnavailableError | null {
  // WebGL (1) and WebGPU (2) are both acceptable. BOTH (3) is WEBGL|WEBGPU.
  // Any CANVAS bit (4) set on its own means the GPU renderers failed.
  const isWebGLOrBetter =
    rendererType === RENDERER_TYPE_WEBGL ||
    rendererType === RENDERER_TYPE_WEBGPU ||
    rendererType === (RENDERER_TYPE_WEBGL | RENDERER_TYPE_WEBGPU);

  if (isWebGLOrBetter) return null;

  // CANVAS (4) or any other value (0, unknown, negative) means no GPU renderer.
  return new WebGLUnavailableError();
}

/**
 * Type guard: was the given value thrown/returned a `WebGLUnavailableError`?
 * Useful for the OfficeCanvas error handler to distinguish WebGL-unavailable
 * from a generic atlas / init failure so the UI can render the compat link.
 */
export function isWebGLUnavailableError(value: unknown): value is WebGLUnavailableError {
  return value instanceof WebGLUnavailableError;
}