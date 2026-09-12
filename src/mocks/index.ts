export async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') {
    return
  }

  const { worker } = await import('./browser')
  const { startAmbientNftDrift } = await import('./realtime-simulation')

  await worker.start({
    onUnhandledRequest: 'bypass',
  })
  startAmbientNftDrift()
}
