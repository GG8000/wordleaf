import { describe, expect, it } from 'vitest'
import { boardFromGuess, isValidClue, leafWords, ratingTier, wordOnEdge } from './clover'
import type { Card } from './types'

const card = (id: string, prefix: string): Card => ({
  id,
  owner_id: 'o',
  tray_order: 0,
  words: ['T', 'R', 'B', 'L'].map((e) => `${prefix}${e}`),
})

describe('wordOnEdge', () => {
  it('returns canonical words without rotation', () => {
    expect([0, 1, 2, 3].map((e) => wordOnEdge(['a', 'b', 'c', 'd'], 0, e))).toEqual(['a', 'b', 'c', 'd'])
  })
  it('rotates clockwise: left word moves to the top', () => {
    expect([0, 1, 2, 3].map((e) => wordOnEdge(['a', 'b', 'c', 'd'], 1, e))).toEqual(['d', 'a', 'b', 'c'])
  })
  it('handles half and three-quarter turns', () => {
    expect(wordOnEdge(['a', 'b', 'c', 'd'], 2, 0)).toBe('c')
    expect(wordOnEdge(['a', 'b', 'c', 'd'], 3, 0)).toBe('b')
  })
})

describe('leafWords', () => {
  const cards = [card('1', 'A'), card('2', 'B'), card('3', 'C'), card('4', 'D')]
  const board = boardFromGuess(cards, {
    '1': { slot: 0, rotation: 0 },
    '2': { slot: 1, rotation: 0 },
    '3': { slot: 2, rotation: 1 },
    '4': { slot: 3, rotation: 0 },
  })
  it('pairs the outward edges of neighbouring slots', () => {
    expect(leafWords(board, 0)).toEqual(['AT', 'BT'])
    expect(leafWords(board, 1)).toEqual(['BR', 'CT'])
    expect(leafWords(board, 2)).toEqual(['CR', 'DB'])
    expect(leafWords(board, 3)).toEqual(['DL', 'AL'])
  })
  it('returns null for empty slots', () => {
    const partial = boardFromGuess(cards, { '1': { slot: 0, rotation: 0 } })
    expect(leafWords(partial, 0)).toEqual(['AT', null])
  })
})

describe('ratingTier / isValidClue', () => {
  it('maps score share to tiers', () => {
    expect(ratingTier(0, 12)).toBe(0)
    expect(ratingTier(6, 12)).toBe(2)
    expect(ratingTier(12, 12)).toBe(4)
  })
  it('accepts single words only', () => {
    expect(isValidClue('Sonne')).toBe(true)
    expect(isValidClue(' Eis-Bär ')).toBe(true)
    expect(isValidClue('two words')).toBe(false)
    expect(isValidClue('')).toBe(false)
  })
})
