import { useQuery } from '@tanstack/react-query'
import { fetchBoard } from '../api'

// Polls the board server (which itself polls Gathered). Previous data is kept
// on errors, so a blip never blanks the wall.
export function useBoard(pollSeconds: number) {
  return useQuery({
    queryKey: ['board'],
    queryFn: ({ signal }) => fetchBoard(signal),
    refetchInterval: pollSeconds * 1000,
    refetchIntervalInBackground: true,
    retry: true,
    retryDelay: (n) => Math.min(30_000, 2_000 * 2 ** n),
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  })
}
