/**
 * Browser-side full-page navigation. Wrapped in its own module so tests
 * can mock the navigation primitive without monkey-patching the
 * non-configurable `window.location`.
 */
export function navigateTo(path: string): void {
  window.location.href = path;
}
