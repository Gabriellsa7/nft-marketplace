import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { socketHandlers } from './socket-server'

export const worker = setupWorker(...handlers, ...socketHandlers)
