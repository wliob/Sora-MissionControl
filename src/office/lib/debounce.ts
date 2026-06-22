/**
 * Trailing-edge debounce: collapses a burst of calls into a single invocation
 * `delay` ms after the last call. The final set of arguments wins.
 *
 * Used to throttle high-frequency events (e.g. ResizeObserver firing on every
 * pixel during a window drag) down to one expensive renderer resize.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): ((...args: A) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: A): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };

  debounced.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}
