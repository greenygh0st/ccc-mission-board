import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, vi } from 'vitest'

// Deterministic tests: no spring/exit animations to wait on.
MotionGlobalConfig.skipAnimations = true

// jsdom gaps
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia
Element.prototype.scrollIntoView ??= vi.fn()
globalThis.CSS ??= { escape: (s: string) => s } as unknown as typeof CSS
if (!CSS.escape) (CSS as unknown as { escape: (s: string) => string }).escape = (s) => s

afterEach(() => cleanup())
