export interface Weather {
  temp: number
  tempMax: number
  tempMin: number
  code: number
  wind: number
  rainProb: number
  label: string
  emoji: string
  advice: string
}

export interface Place {
  name: string
  lat: number
  lon: number
}

const PLACE_KEY = 'myflow-place'
export const DEFAULT_PLACE: Place = { name: 'Stockholm', lat: 59.33, lon: 18.07 }

export function getPlace(): Place {
  try {
    const raw = localStorage.getItem(PLACE_KEY)
    if (raw) return JSON.parse(raw) as Place
  } catch {
    /* ignore */
  }
  return DEFAULT_PLACE
}

export function setPlace(p: Place) {
  localStorage.setItem(PLACE_KEY, JSON.stringify(p))
}

const CODES: Record<number, [string, string]> = {
  0: ['Klart', '☀️'],
  1: ['Mest klart', '🌤️'],
  2: ['Halvklart', '⛅'],
  3: ['Molnigt', '☁️'],
  45: ['Dimma', '🌫️'],
  48: ['Dimma', '🌫️'],
  51: ['Duggregn', '🌦️'],
  53: ['Duggregn', '🌦️'],
  55: ['Duggregn', '🌧️'],
  61: ['Lite regn', '🌧️'],
  63: ['Regn', '🌧️'],
  65: ['Mycket regn', '🌧️'],
  66: ['Underkylt regn', '🌧️'],
  67: ['Underkylt regn', '🌧️'],
  71: ['Lite snö', '🌨️'],
  73: ['Snö', '🌨️'],
  75: ['Mycket snö', '❄️'],
  77: ['Snökorn', '🌨️'],
  80: ['Regnskurar', '🌦️'],
  81: ['Regnskurar', '🌧️'],
  82: ['Kraftiga skurar', '🌧️'],
  85: ['Snöbyar', '🌨️'],
  86: ['Snöbyar', '❄️'],
  95: ['Åska', '⛈️'],
  96: ['Åska', '⛈️'],
  99: ['Åska', '⛈️'],
}

const RAINY = new Set([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])

function advice(code: number, rainProb: number, tempMax: number, wind: number): string {
  if (RAINY.has(code) || rainProb >= 40) return 'Ta med paraply.'
  if (tempMax <= 0) return 'Kallt ute — ta en varm jacka.'
  if (wind >= 10) return 'Blåsigt — ta något vindtätt.'
  if (tempMax >= 25) return 'Varmt idag — ta med vatten.'
  return 'Inget särskilt att tänka på.'
}

export async function fetchWeather(p: Place): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=1&wind_speed_unit=ms`
  const res = await fetch(url)
  if (!res.ok) throw new Error('weather ' + res.status)
  const j = await res.json()
  const code: number = j.current.weather_code
  const [label, emoji] = CODES[code] ?? ['Väder', '🌡️']
  const rainProb: number = j.daily.precipitation_probability_max?.[0] ?? 0
  const tempMax: number = j.daily.temperature_2m_max?.[0] ?? j.current.temperature_2m
  const wind: number = j.current.wind_speed_10m ?? 0
  return {
    temp: Math.round(j.current.temperature_2m),
    tempMax: Math.round(tempMax),
    tempMin: Math.round(j.daily.temperature_2m_min?.[0] ?? tempMax),
    code,
    wind,
    rainProb,
    label,
    emoji,
    advice: advice(code, rainProb, tempMax, wind),
  }
}

/** Sök stad via Open-Meteos geocoding (gratis, ingen nyckel). */
export async function searchPlace(name: string): Promise<Place | null> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=sv`,
  )
  if (!res.ok) return null
  const j = await res.json()
  const r = j.results?.[0]
  return r ? { name: r.name, lat: r.latitude, lon: r.longitude } : null
}
