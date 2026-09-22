import type { RoomData } from '../hooks/useRoom'
import type { Room } from '../lib/types'

export interface GameProps extends RoomData {
  room: Room
  userId: string
  online: Set<string>
  patchRoom: (patch: Partial<Room>) => void
}
