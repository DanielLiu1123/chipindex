import { getToken } from './auth'
import type { PlayerStats } from '../types'

function authHeaders(): Record<string, string> {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { ...authHeaders(), ...options?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? res.statusText)
  }
  return res.json()
}

export function fetchLeaderboard(): Promise<PlayerStats[]> {
  return apiFetch('/api/leaderboard')
}

export function fetchPlayers() {
  return apiFetch<any[]>('/api/players')
}

export function fetchSessions() {
  return apiFetch<any[]>('/api/sessions')
}

export function fetchSessionDetail(id: string) {
  return apiFetch<any>(`/api/sessions/${id}`)
}

export function fetchPlayerDetail(id: string) {
  return apiFetch<any>(`/api/players/${id}`)
}

export async function createPlayer(name: string) {
  return apiFetch<any>('/api/players', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function createSession(
  date: string,
  exchange_rate: number | null,
  entries: { playerId: string; chips: number }[]
) {
  return apiFetch<any>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      date,
      exchange_rate,
      entries: entries.map(e => ({ player_id: e.playerId, chips: e.chips })),
    }),
  })
}
