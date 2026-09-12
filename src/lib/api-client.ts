import axios, { AxiosError } from 'axios'
import { getAuthToken, getOrCreateGuestCartId } from '@/lib/auth-storage'
import { ApiError, type ApiErrorBody } from '@/types'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  } else {
    config.headers.set('X-Guest-Cart-Id', getOrCreateGuestCartId())
  }
  return config
})

export const UNAUTHORIZED_EVENT = 'nft-marketplace:unauthorized'

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response) {
      const body = error.response.data ?? {
        code: 'transient_error',
        message: 'Erro inesperado do servidor.',
      }
      const apiError = new ApiError(error.response.status, body)

      if (apiError.code === 'unauthenticated' && !error.config?.url?.includes('/auth/session')) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
      }

      return Promise.reject(apiError)
    }

    return Promise.reject(
      new ApiError(0, {
        code: 'transient_error',
        message: 'Falha de conexão. Verifique sua internet e tente novamente.',
      }),
    )
  },
)
