import i18n from '../i18n'
import { getRoomId } from './room'
import { supabase } from './supabase'
import { showToast } from './toast'

/** Call a game RPC for the current room. Errors are shown as a translated toast and re-thrown. */
export async function rpc<T = void>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, { p_room: getRoomId(), ...args })
  if (error) {
    showToast(errorText(error.message))
    throw error
  }
  return data as T
}

export function errorText(code: string): string {
  const key = `errors.${code}`
  return i18n.exists(key) ? i18n.t(key) : i18n.t('errors.generic', { msg: code })
}

/** Open a private lobby and join it. Returns its code. */
export async function createRoom(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_room', { p_name: name })
  if (error) {
    showToast(errorText(error.message))
    throw error
  }
  return data as string
}
