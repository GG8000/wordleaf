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

export interface MapPoint {
  lat: number
  lon: number
  players: number
}
