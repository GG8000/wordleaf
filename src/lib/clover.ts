import type { Card, Placement, Solution } from './types'

// Edges: 0 top, 1 right, 2 bottom, 3 left
// Slots: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left
export const SLOTS = [0, 1, 2, 3] as const

// Each leaf sits on one side of the board and touches that edge of two cards
export const LEAVES = [
  { edge: 0, slots: [0, 1] },
  { edge: 1, slots: [1, 2] },
  { edge: 2, slots: [2, 3] },
  { edge: 3, slots: [3, 0] },
] as const

export const POINTS_PERFECT = 6

/** Word shown on `edge` of a card turned clockwise `rotation` quarter turns */
export function wordOnEdge(words: string[], rotation: number, edge: number): string {
  return words[(((edge - rotation) % 4) + 4) % 4]
}

export interface BoardSlot {
  card: Card
  rotation: number
}

export type Board = (BoardSlot | null)[]

/** The two words a leaf's clue has to connect, or null where a slot is empty */
export function leafWords(board: Board, leaf: number): [string | null, string | null] {
  const { edge, slots } = LEAVES[leaf]
  const pick = (slot: number) => {
    const s = board[slot]
    return s ? wordOnEdge(s.card.words, s.rotation, edge) : null
  }
  return [pick(slots[0]), pick(slots[1])]
}

export function boardFromSolutions(cards: Card[], solutions: Solution[]): Board {
  const board: Board = [null, null, null, null]
  for (const s of solutions) {
    const card = cards.find((c) => c.id === s.card_id)
    if (card && s.slot !== null) board[s.slot] = { card, rotation: s.rotation }
  }
  return board
}

export function boardFromGuess(cards: Card[], guess: Record<string, Placement>): Board {
  const board: Board = [null, null, null, null]
  for (const [id, p] of Object.entries(guess)) {
    const card = cards.find((c) => c.id === id)
    if (card && p.slot !== null) board[p.slot] = { card, rotation: p.rotation }
  }
  return board
}

/** Rating tier key (0 = worst … 4 = best) from the share of the maximum score */
export function ratingTier(score: number, max: number): number {
  if (max <= 0) return 0
  const r = score / max
  if (r >= 0.9) return 4
  if (r >= 0.75) return 3
  if (r >= 0.5) return 2
  if (r >= 0.25) return 1
  return 0
}

/** Clues are single words: no whitespace, 1-30 chars */
export function isValidClue(clue: string): boolean {
  const c = clue.trim()
  return c.length >= 1 && c.length <= 30 && !/\s/.test(c)
}
