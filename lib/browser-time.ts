// Calendar inputs and display use the browser's local zone. Database timestamps
// remain ISO instants; a session's date remains a date, never an implicit UTC day.
const pad = (value: number) => String(value).padStart(2, '0')
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
export function toDateTimeLocal(value: string): string {
  const date = new Date(value)
  return `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
export function toIsoTimestamp(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Enter a valid local date and time.')
  return date.toISOString()
}
export function localTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
export function localDateTime(value: string): string {
  const date = new Date(value)
  return `${localDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
