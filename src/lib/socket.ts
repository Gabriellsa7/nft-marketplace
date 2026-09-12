import type { Socket } from 'socket.io-client'

/**
 * `socket.io-client` captures `globalThis.WebSocket` into a module-level variable the
 * moment it's evaluated. If this were a static top-level import, it would run — and
 * permanently capture the *unpatched* native WebSocket — before `enableMocking()` gets
 * a chance to patch it via MSW. A dynamic import defers evaluation until first call,
 * which callers only make after mocks are already running (see useRealtimeSync).
 */
let socketPromise: Promise<Socket> | null = null

export function getSocket(): Promise<Socket> {
  if (!socketPromise) {
    socketPromise = import('socket.io-client').then(({ io }) =>
      io(import.meta.env.VITE_SOCKET_URL ?? '/', {
        autoConnect: false,
        withCredentials: true,
        // The mock transport (@mswjs/socket.io-binding) only intercepts native WebSocket
        // connections, not the HTTP long-polling handshake — force websocket-only so the
        // client never attempts the polling upgrade dance against the mock server.
        transports: ['websocket'],
      }),
    )
  }
  return socketPromise
}
