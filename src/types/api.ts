export type ApiErrorCode =
  | 'validation_error'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'idempotency_conflict'
  | 'coupon_invalid'
  | 'coupon_expired'
  | 'availability_conflict'
  | 'quote_stale'
  | 'transient_error'

export interface FieldError {
  field: string
  message: string
}

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  fields?: FieldError[]
}

export class ApiError extends Error {
  code: ApiErrorCode
  fields?: FieldError[]
  status: number

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.status = status
    this.code = body.code
    this.fields = body.fields
  }
}
