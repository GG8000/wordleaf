import type { ReactNode } from 'react'
import type { DuelData } from '../../hooks/useDuel'
import type { Duel, DuelGuess, DuelPlayer } from '../../lib/types'

export interface DuelProps extends DuelData {
  duel: Duel
  userId: string
  me: DuelPlayer
  opponent: DuelPlayer | undefined
  /** Your board for the opponent's clover (from guessing on) */
  myGuess: DuelGuess | undefined
  /** The opponent's board for your clover */
  theirGuess: DuelGuess | undefined
  patchGuess: (patch: Partial<DuelGuess>) => void
  /** Rendered where waiting for the opponent, so players can turn on notifications */
  pushPrompt: ReactNode
}
