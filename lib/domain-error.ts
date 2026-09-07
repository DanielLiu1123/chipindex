export type DomainErrorCode = 'invalid_input' | 'not_found' | 'conflict' | 'rule_violation' | 'unbalanced'

export class DomainError extends Error {
  constructor(public code: DomainErrorCode, message: string, public details?: Record<string, unknown>) {
    super(message)
    this.name = 'DomainError'
  }
}
