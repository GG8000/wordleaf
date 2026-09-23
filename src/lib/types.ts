export type Status = 'lobby' | 'writing' | 'guessing' | 'finished'
export type Lang = 'en' | 'de' | 'fr'
export type Level = 1 | 2 | 3

export interface Placement {
  slot: number | null
  rotation: number
}

export interface Room {
  id: string
  host_id: string | null
  status: Status
  card_lang: Lang
  level: Level
  allow_shuffle: boolean
  allow_chat: boolean
  turn_order: string[]
  current_turn: number
  attempt: number
  revealing: boolean
  guess_state: Record<string, Placement>
  locked_slots: number[]
  score: number
  updated_at: string
}

export interface Player {
  user_id: string
  name: string
  joined_at: string
  ready: boolean
}

export interface Clover {
  owner_id: string
  owner_name: string
  clues: string[] | null
  submitted: boolean
  points: number | null
  revealed: boolean
  shuffled: boolean
}

export interface Card {
  id: string
  owner_id: string
  words: string[]
  tray_order: number
}

export interface Solution {
  card_id: string
  owner_id: string
  slot: number | null
  rotation: number
}

export interface ChatMessage {
  id: number
  user_id: string
  name: string
  body: string
  created_at: string
}

export interface MapPoint {
  lat: number
  lon: number
  players_now: number
  /** Played here in the last 7 days, including now */
  players_week: number
  players_total: number
}

export type DuelStatus = 'waiting' | 'writing' | 'guessing' | 'finished' | 'abandoned'

export interface Duel {
  id: string
  card_lang: Lang
  level: Level
  allow_shuffle: boolean
  status: DuelStatus
  created_by: string | null
  rematch_id: string | null
  updated_at: string
}

export interface DuelPlayer {
  user_id: string
  name: string
  joined_at: string
  clues: string[] | null
  submitted: boolean
  shuffled: boolean
  /** What the opponent scored on this player's clover; null until solved */
  points: number | null
}

/** One player's own board for the opponent's clover */
export interface DuelGuess {
  guesser_id: string
  owner_id: string
  state: Record<string, Placement>
  attempt: number
  locked_slots: number[]
  done: boolean
  updated_at: string
}

/** A row of my_duels() */
export interface DuelSummary {
  id: string
  status: DuelStatus
  opponent_name: string | null
  my_turn: boolean
  score: number
  card_lang: Lang
  level: Level
  updated_at: string
}
