import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { DuelData } from '../../hooks/useDuel'
import { POINTS_PERFECT, ratingTier } from '../../lib/clover'
import { duelLink, setDuelId } from '../../lib/duel'
import { playEffect } from '../../lib/effects'
import { duelRpc } from '../../lib/rpc'
import { showToast } from '../../lib/toast'
import type { Duel, DuelGuess } from '../../lib/types'
import { DuelGuessing } from './DuelGuessing'
import { DuelWriting } from './DuelWriting'
import { PushPrompt } from './PushPrompt'
import { SolvedClover } from './SolvedClover'
import type { DuelProps } from './types'

interface Props extends DuelData {
  duel: Duel
  userId: string
  patchGuess: (patch: Partial<DuelGuess>) => void
  onShowInstall: () => void
}

/** A single duel, routed by its status */
export function DuelView(props: Props) {
  const { t } = useTranslation()
  const { duel, players, guesses, userId, onShowInstall } = props
  const me = players.find((p) => p.user_id === userId)
  const opponent = players.find((p) => p.user_id !== userId)
  const myGuess = guesses.find((g) => g.guesser_id === userId)
  const theirGuess = guesses.find((g) => g.guesser_id !== userId)
  const pushPrompt = <PushPrompt onShowInstall={onShowInstall} />

  useSolveEffects(myGuess, opponent?.points ?? null)

  if (!me) return null
  const p: DuelProps = { ...props, me, opponent, myGuess, theirGuess, pushPrompt }

  async function leave() {
    const finished = duel.status === 'finished' || duel.status === 'abandoned'
    if (!finished && !confirm(t('duel.leaveConfirm'))) return
    await duelRpc('leave_duel').then(() => setDuelId(null), () => {})
  }

  let content
  if (duel.status === 'waiting') {
    content = <Waiting duelId={duel.id} pushPrompt={pushPrompt} />
  } else if (duel.status === 'writing') {
    content = <DuelWriting {...p} />
  } else if (duel.status === 'guessing' && myGuess && !myGuess.done) {
    content = <DuelGuessing {...p} myGuess={myGuess} />
  } else if (duel.status === 'guessing') {
    // You're done, the opponent is still solving your clover (you can watch)
    content = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 text-center shadow-sm">
          <p className="font-semibold text-leaf-700">{t('duel.waitSolve', { name: opponent?.name ?? '…' })}</p>
          {pushPrompt}
        </div>
        {opponent && (
          <SolvedClover title={t('duel.theirClover', { name: opponent.name })} owner={opponent} guess={myGuess} cards={p.cards} solutions={p.solutions} />
        )}
        <SolvedClover title={t('duel.yourCloverLive', { name: opponent?.name ?? '…' })} owner={me} guess={theirGuess} cards={p.cards} solutions={p.solutions} />
      </div>
    )
  } else if (duel.status === 'finished') {
    content = <Finished {...p} />
  } else {
    content = (
      <p className="mx-auto max-w-md rounded-xl bg-amber-100 p-4 text-center text-amber-900">
        {t('duel.abandoned', { name: opponent?.name ?? '…' })}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setDuelId(null)} className="text-sm text-stone-600 hover:text-leaf-700">
          ← {t('duel.back')}
        </button>
        <span className="text-sm font-semibold text-stone-700">
          {opponent ? t('duel.vs', { name: opponent.name }) : t('duel.waitingTitle')}
        </span>
      </div>
      {content}
      <button type="button" onClick={leave} className="mx-auto mt-4 text-xs text-stone-400 hover:text-rose-600">
        {duel.status === 'finished' || duel.status === 'abandoned' ? t('duel.remove') : t('duel.leave')}
      </button>
    </div>
  )
}

/** Clover confetti / falling leaves when your board is scored, only if it happens while you watch */
function useSolveEffects(myGuess: DuelGuess | undefined, points: number | null) {
  const wasDone = useRef<boolean | null>(null)
  useEffect(() => {
    if (!myGuess) return
    if (wasDone.current === false && myGuess.done && points != null) {
      if (points === POINTS_PERFECT) playEffect({ kind: 'rain', emojis: ['🍀', '🍀', '🍀', '✨', '🎉'] })
      else if (points === 0) playEffect({ kind: 'rain', emojis: ['🍂', '🍁', '🥀'], count: 16, slow: true })
      else playEffect({ kind: 'splash', text: `+${points} 🍀` })
    }
    if (points != null || !myGuess.done) wasDone.current = myGuess.done
  }, [myGuess, points])
}

function Waiting({ duelId, pushPrompt }: { duelId: string; pushPrompt: ReactNode }) {
  const { t } = useTranslation()
  const link = duelLink(duelId)

  async function share() {
    const text = t('duel.shareText')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Wordleaf', text, url: link })
        return
      }
    } catch {
      return // cancelled
    }
    try {
      await navigator.clipboard.writeText(link)
      showToast(t('lobby.linkCopied'))
    } catch {
      showToast(link)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-3xl bg-white p-6 text-center shadow">
      <p className="text-stone-600">{t('duel.waitingHint')}</p>
      <span className="rounded-2xl bg-leaf-100 px-6 py-3 font-mono text-4xl font-extrabold tracking-[0.3em] text-leaf-800">{duelId}</span>
      <button type="button" onClick={share} className="rounded-xl bg-leaf-600 px-5 py-3 font-bold text-white hover:bg-leaf-700">
        {t('duel.share')}
      </button>
      <p className="text-xs text-stone-500">{t('duel.codeHint')}</p>
      {pushPrompt}
    </div>
  )
}

function Finished({ duel, me, opponent, myGuess, theirGuess, cards, solutions }: DuelProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const score = (me.points ?? 0) + (opponent?.points ?? 0)
  const max = 2 * POINTS_PERFECT
  const tier = ratingTier(score, max)

  async function rematch() {
    setBusy(true)
    try {
      setDuelId(await duelRpc<string>('rematch_duel'))
    } catch {
      // toast already shown
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2 rounded-3xl bg-white p-6 text-center shadow">
        <div className="text-4xl">{'🍀'.repeat(Math.max(tier, 1))}</div>
        <p className="text-xl font-bold text-leaf-700">{t('results.score', { score, max })}</p>
        <p className="text-stone-600">{(t('results.tiers', { returnObjects: true }) as string[])[tier]}</p>
        {opponent && (
          <button
            type="button"
            onClick={rematch}
            disabled={busy}
            className="mt-2 rounded-xl bg-leaf-600 px-5 py-3 font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
          >
            {duel.rematch_id ? t('duel.toRematch') : t('duel.rematch')}
          </button>
        )}
      </div>
      {opponent && (
        <SolvedClover title={t('duel.theirClover', { name: opponent.name })} owner={opponent} guess={myGuess} cards={cards} solutions={solutions} />
      )}
      <SolvedClover title={t('duel.yourClover', { name: opponent?.name ?? '…' })} owner={me} guess={theirGuess} cards={cards} solutions={solutions} />
    </div>
  )
}
