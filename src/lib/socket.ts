import type { Socket } from 'socket.io-client'

let socketPromise: Promise<Socket> | null = null

export function getSocket(): Promise<Socket> {
  if (!socketPromise) {
    socketPromise = import('socket.io-client').then(({ io }) =>
      io(import.meta.env.VITE_SOCKET_URL ?? '/', {
        autoConnect: false,
        withCredentials: true,
        transports: ['websocket'],
      }),
    )
  }
  return socketPromise
}
