import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount rendered components, and forget saved host settings, between tests
afterEach(() => {
  cleanup()
  // The worker tests run without a DOM
  if (typeof localStorage !== 'undefined') localStorage.clear()
})
