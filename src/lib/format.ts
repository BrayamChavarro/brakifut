/**
 * Formateo de fechas para la interfaz.
 *
 * Decision importante: formateamos siempre en una zona horaria fija
 * (DISPLAY_TIMEZONE, por defecto America/Argentina/Buenos_Aires) y no en la del
 * navegador. El HTML se renderiza en el servidor; si usaramos la zona del
 * cliente, el markup del servidor y el del cliente no coincidirian y React
 * tiraria un error de hidratacion.
 */

const TIMEZONE =
  process.env.DISPLAY_TIMEZONE?.trim() || "America/Argentina/Buenos_Aires";

const LOCALE = "es-AR";

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "sab 12 oct" */
export function formatShortDate(iso: string): string {
  return capitalize(dateFormatter.format(new Date(iso)));
}

/** "sabado 12 de octubre de 2025" */
export function formatLongDate(iso: string): string {
  return capitalize(longDateFormatter.format(new Date(iso)));
}

/** "21:00" */
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** "12/10/2025 21:00" */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** Clave "AAAA-MM-DD" en la zona de despliegue: agrupa partidos por dia. */
export function toDateKey(iso: string): string {
  return dateKeyFormatter.format(new Date(iso));
}

/** "AAAA-MM-DD" de hoy, en la zona de despliegue. */
export function todayKey(): string {
  return toDateKey(new Date().toISOString());
}

/** Suma (o resta) dias a una clave de fecha, sin salir de la zona de despliegue. */
export function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const base = Date.UTC(year, month - 1, day);
  const shifted = new Date(base + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
