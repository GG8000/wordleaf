import i18n from '../i18n'
import { ROOM_ID, supabase } from './supabase'
import { showToast } from './toast'

/** Call a game RPC for the lobby. Errors are shown as a translated toast and re-thrown. */
export async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabase.rpc(fn, { ...args, p_room: ROOM_ID })
  if (error) {
    showToast(errorText(error.message))
    throw error
  }
}

export function errorText(code: string): string {
  const key = `errors.${code}`
  return i18n.exists(key) ? i18n.t(key) : i18n.t('errors.generic', { msg: code })
}
