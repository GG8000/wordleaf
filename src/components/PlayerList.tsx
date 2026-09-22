import { useTranslation } from 'react-i18next'
import type { Player } from '../lib/types'

interface Props {
  players: Player[]
  hostId: string | null
  userId: string
  online: Set<string>
  badge?: (p: Player) => React.ReactNode
  onKick?: (p: Player) => void
}

export function PlayerList({ players, hostId, userId, online, badge, onKick }: Props) {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-col gap-1">
      {players.map((p) => (
        <li key={p.user_id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${online.has(p.user_id) ? 'bg-emerald-500' : 'bg-stone-300'}`}
            title={online.has(p.user_id) ? t('common.online') : t('common.offline')}
          />
          <span className="flex-1 truncate font-medium">
            {p.name}
            {p.user_id === userId && <span className="text-stone-400"> ({t('common.you')})</span>}
            {p.user_id === hostId && <span title={t('common.host')}> 👑</span>}
          </span>
          {badge?.(p)}
          {onKick && p.user_id !== userId && (
            <button type="button" onClick={() => onKick(p)} className="text-xs text-rose-600 hover:underline">
              {t('lobby.kick')}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
