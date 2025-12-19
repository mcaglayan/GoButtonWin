import '@testing-library/jest-dom/vitest';

// Some components depend on these browser APIs.
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number;
}
if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as NodeJS.Timeout);
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  // @ts-expect-error - test shim
  globalThis.ResizeObserver = ResizeObserverStub;
}

// Default Electron preload API stubs for tests.
// Individual tests can override these.
Object.defineProperty(window, 'app', {
  value: {
    storage: {
      loadShows: async () => null,
      saveShows: async () => {},
    },
    onMenuAction: () => {},
  },
  writable: true,
});
