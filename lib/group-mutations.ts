import { db } from './db'
import { ApiError } from './http'
import { ensure, now, requireGroup, requirePlayer } from './mutation-guards'
import type { Group, GroupPlayer, Player } from '@/types'

export async function createGroup(name: string): Promise<Group> {
  const trimmed = name?.trim()
  if (!trimmed) throw new ApiError(400, 'Name required')
  const { data, error } = await db.from('group').insert({ name: trimmed }).select().single()
  if (error?.code === '23505') throw new ApiError(409, 'Group name already exists')
  ensure(error)
  if (!data) throw new ApiError(500, 'Database write returned no data')
  return data
}

export async function renameGroup(id: string, name: string): Promise<Group> {
  const trimmed = name?.trim()
  if (!trimmed) throw new ApiError(400, 'Name required')
  const { data, error } = await db.from('group').update({ name: trimmed, updated_at: now() }).eq('id', id).is('deleted_at', null).select().maybeSingle()
  if (error?.code === '23505') throw new ApiError(409, 'Group name already exists')
  ensure(error)
  if (!data) throw new ApiError(404, 'Group not found')
  return data
}

async function insertGroupPlayer(groupId: string, playerId: string): Promise<GroupPlayer> {
  const { data, error } = await db.from('group_player').insert({ group_id: groupId, player_id: playerId }).select().single()
  if (error?.code === '23505') throw new ApiError(409, 'Player already exists in group')
  ensure(error)
  if (!data) throw new ApiError(500, 'Database write returned no data')
  return data
}

export async function createGroupPlayer(groupId: string, playerId: string): Promise<GroupPlayer> {
  if (!playerId) throw new ApiError(400, 'player_id required')
  await Promise.all([requireGroup(groupId), requirePlayer(playerId)])
  return insertGroupPlayer(groupId, playerId)
}

export async function deleteGroupPlayer(groupId: string, playerId: string): Promise<GroupPlayer> {
  if (!playerId) throw new ApiError(400, 'player_id required')
  const timestamp = now()
  const { data, error } = await db.from('group_player').update({ deleted_at: timestamp, updated_at: timestamp }).eq('group_id', groupId).eq('player_id', playerId).is('deleted_at', null).select().maybeSingle()
  ensure(error)
  if (!data) throw new ApiError(404, 'Group player not found')
  return data
}

export async function createPlayer(name: string, groupId: string): Promise<{ player: Player; group_player: GroupPlayer }> {
  const trimmed = name?.trim()
  if (!trimmed) throw new ApiError(400, 'Name required')
  await requireGroup(groupId)
  const { data: player, error } = await db.from('player').insert({ name: trimmed }).select().single()
  ensure(error)
  if (!player) throw new ApiError(500, 'Database write returned no data')
  try {
    return { player, group_player: await insertGroupPlayer(groupId, player.id) }
  } catch (cause) {
    const timestamp = now()
    await db.from('player').update({ deleted_at: timestamp, updated_at: timestamp }).eq('id', player.id)
    throw cause
  }
}

export async function renamePlayer(groupId: string, id: string, name: string): Promise<Player> {
  const trimmed = name?.trim()
  if (!trimmed) throw new ApiError(400, 'Name required')
  const { data: membership, error: membershipError } = await db.from('group_player').select('id').eq('group_id', groupId).eq('player_id', id).is('deleted_at', null).maybeSingle()
  ensure(membershipError)
  if (!membership) throw new ApiError(404, 'Player not found in group')
  const { data, error } = await db.from('player').update({ name: trimmed, updated_at: now() }).eq('id', id).is('deleted_at', null).select().maybeSingle()
  ensure(error)
  if (!data) throw new ApiError(404, 'Player not found')
  return data
}
