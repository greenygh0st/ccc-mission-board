import type { BoardResponse } from './types'

export class BoardNotReady extends Error {}

export async function fetchBoard(signal?: AbortSignal): Promise<BoardResponse> {
  const res = await fetch('/api/board', { signal, headers: { Accept: 'application/json' } })
  if (res.status === 503) throw new BoardNotReady('The board server has not reached Gathered yet')
  if (!res.ok) throw new Error(`Board request failed (${res.status})`)
  return (await res.json()) as BoardResponse
}
