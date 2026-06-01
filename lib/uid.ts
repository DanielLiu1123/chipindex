// Generate a local id for form rows (used only as a React key / transient
// identifier, not a security token). crypto.randomUUID is only available in
// secure contexts (HTTPS/localhost); it is missing when a phone hits the dev
// server over plain HTTP on the LAN, so fall back to Math.random.
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
