// 生成表单行的本地 id（仅用作 React key / 临时标识，非安全令牌）。
// crypto.randomUUID 只在安全上下文(HTTPS/localhost)可用，手机经局域网明文
// HTTP 访问时不存在，故降级到 Math.random。
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
