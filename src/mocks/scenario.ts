export type MockScenario = 'default' | 'slow' | 'flaky' | 'offline' | 'empty'

const STORAGE_KEY = 'nft-marketplace-mock-scenario'
const VALID: MockScenario[] = ['default', 'slow', 'flaky', 'offline', 'empty']

export function getScenario(): MockScenario {
  try {
    const url = new URL(window.location.href)
    const fromQuery = url.searchParams.get('mock_scenario')
    if (fromQuery && VALID.includes(fromQuery as MockScenario)) {
      localStorage.setItem(STORAGE_KEY, fromQuery)
      return fromQuery as MockScenario
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && VALID.includes(stored as MockScenario)) return stored as MockScenario
  } catch {
    // ignore, default below
  }
  return 'default'
}

export function setScenario(scenario: MockScenario) {
  try {
    localStorage.setItem(STORAGE_KEY, scenario)
  } catch {
    // ignore
  }
}

/** Deterministic pseudo-random in [0,1) seeded by a string, so scenarios stay reproducible per request. */
function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0
  }
  return (hash >>> 0) / 4294967295
}

export class MockNetworkError extends Error {
  constructor() {
    super('mock_network_unavailable')
  }
}

/**
 * Applies the current scenario's latency/failure behavior before a handler resolves.
 * `key` seeds determinism (e.g. request url + method) so retries in tests are reproducible.
 */
export async function simulateNetwork(key: string): Promise<void> {
  const scenario = getScenario()
  const roll = seededRandom(key)

  if (scenario === 'offline') {
    await delay(300)
    throw new MockNetworkError()
  }

  if (scenario === 'flaky') {
    await delay(200 + roll * 1500)
    if (roll < 0.25) throw new MockNetworkError()
    return
  }

  if (scenario === 'slow') {
    await delay(1500 + roll * 2500)
    return
  }

  await delay(80 + roll * 220)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
