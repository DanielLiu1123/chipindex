import { currentSpace, AUTH_COOKIE } from './spaces'

export { AUTH_COOKIE }

// Authenticated iff the request carries a valid, in-config space cookie.
export async function isAuthenticated(): Promise<boolean> {
  return (await currentSpace()) !== null
}
