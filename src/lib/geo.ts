import { supabase } from './supabase'

const SHARED_KEY = 'wordleaf-location-shared'

/** Put the player on the map, roughly (IP-based; the server rounds it to ~10 km). Once per session, never fails. */
export async function shareLocation() {
  try {
    if (sessionStorage.getItem(SHARED_KEY)) return
  } catch {
    // storage unavailable: just look it up again
  }
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json')
    const geo = (await res.json()) as { latitude?: string; longitude?: string }
    const lat = Number(geo.latitude)
    const lon = Number(geo.longitude)
    if (!geo.latitude || !geo.longitude || !Number.isFinite(lat) || !Number.isFinite(lon)) return
    const { error } = await supabase.rpc('set_location', { p_lat: lat, p_lon: lon })
    if (error) return
    try {
      sessionStorage.setItem(SHARED_KEY, '1')
    } catch {
      // storage unavailable
    }
  } catch {
    // blocked by a content blocker or offline: the player just isn't on the map
  }
}
