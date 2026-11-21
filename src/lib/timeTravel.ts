// Helpers backing the DATE & TIME TRAVEL feature (routes/index.tsx's clock
// readout + TimeTravelDialog): a simulated "current" date that can be pinned to
// an arbitrary moment and keeps ticking forward in real time from there, an
// optional mapping of that date's local time-of-day onto the app's existing
// 0..1 TIMEOFDAY dial via a northern-hemisphere sunrise/sunset approximation,
// and the year-2100 "futuristic" cutoff.

// Representative northern-hemisphere latitude (Stockholm-ish) used when no
// other latitude is given — this app has no location/GPS input, so seasonal
// sunrise/sunset is illustrative rather than tied to the player's real place.
const DEFAULT_LATITUDE_DEG = 59.33;

const MS_PER_DAY = 86_400_000;

function dayOfYear(date: Date): number {
  const start = new Date(0);
  start.setUTCFullYear(date.getFullYear(), 0, 1);
  start.setUTCHours(0, 0, 0, 0);
  const day = new Date(0);
  day.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  day.setUTCHours(0, 0, 0, 0);
  return Math.floor((day.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

// Sunrise/sunset as local clock hours (0..24) for a given date and latitude,
// via the standard solar-declination approximation. Ignores the equation of
// time and longitude/standard timezone offset, but includes the local DST
// shift. This is for a seasonal look, not real-world navigation.
export function sunriseSunsetHours(
  date: Date,
  latitudeDeg: number = DEFAULT_LATITUDE_DEG,
): { sunrise: number; sunset: number } {
  const n = dayOfYear(date);
  const declRad = ((23.44 * Math.PI) / 180) * Math.sin((2 * Math.PI * (284 + n)) / 365);
  const latRad = (latitudeDeg * Math.PI) / 180;
  const cosH = -Math.tan(latRad) * Math.tan(declRad);
  const january = new Date(date);
  january.setMonth(0, 1);
  const july = new Date(date);
  july.setMonth(6, 1);
  const standardOffset = Math.max(january.getTimezoneOffset(), july.getTimezoneOffset());
  const noon = 12 + (standardOffset - date.getTimezoneOffset()) / 60;
  if (cosH <= -1) return { sunrise: 0, sunset: 24 }; // midnight sun
  if (cosH >= 1) return { sunrise: noon, sunset: noon }; // polar night
  const hourAngleHours = (Math.acos(cosH) * (180 / Math.PI)) / 15;
  return {
    sunrise: Math.max(0, noon - hourAngleHours),
    sunset: Math.min(24, noon + hourAngleHours),
  };
}

// Maps a date's local hour-of-day onto the app's TIMEOFDAY dial (0 = midnight,
// 0.25 = sunrise, 0.5 = solar noon, 0.75 = sunset — see palette() in
// routes/index.tsx), stretching the day/night portions to this date's actual
// sunrise/sunset instead of the fixed 6am/6pm the dial otherwise assumes.
export function northernHemisphereTimeOfDay(
  date: Date,
  latitudeDeg: number = DEFAULT_LATITUDE_DEG,
): number {
  const { sunrise, sunset } = sunriseSunsetHours(date, latitudeDeg);
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const noon = (sunrise + sunset) / 2;
  if (hour <= sunrise) return sunrise <= 0 ? 0.25 : (hour / sunrise) * 0.25;
  if (hour <= noon) {
    return noon <= sunrise ? 0.5 : 0.25 + ((hour - sunrise) / (noon - sunrise)) * 0.25;
  }
  if (hour <= sunset) {
    return sunset <= noon ? 0.75 : 0.5 + ((hour - noon) / (sunset - noon)) * 0.25;
  }
  return sunset >= 24 ? 0.75 : 0.75 + ((hour - sunset) / (24 - sunset)) * 0.25;
}

// The simulated "now": real current time, unless a time-travel base was set
// (baseMs), in which case elapsed real time since setAtMs is scaled by speed.
export function simulatedDate(baseMs: number | null, setAtMs: number | null, speed = 1): Date {
  if (baseMs == null || setAtMs == null) return new Date();
  return new Date(baseMs + (Date.now() - setAtMs) * speed);
}

// Once the simulated clock passes this year, environments switch to their
// futuristic ("future" era) look.
export const FUTURISTIC_YEAR = 2100;

export function isFuturisticYear(date: Date, thresholdYear: number = FUTURISTIC_YEAR): boolean {
  return date.getFullYear() >= thresholdYear;
}

// Formats a Date for an <input type="datetime-local"> value, in local time.
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear().toString().padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  const date = new Date(0);
  date.setFullYear(y, m - 1, d);
  date.setHours(h, min, 0, 0);
  return date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d &&
    date.getHours() === h &&
    date.getMinutes() === min
    ? date
    : null;
}

export function sameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function seekLocalMinute(date: Date, minute: number): Date {
  const result = new Date(date);
  result.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return result;
}
