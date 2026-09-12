export async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') {
    return
  }

  const { worker } = await import('./browser')

  return worker.start({
    onUnhandledRequest: 'bypass',
  })
}
