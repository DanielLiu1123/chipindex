export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : GENERIC_ERROR_MESSAGE
}
