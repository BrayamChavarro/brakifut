/**
 * Manejo de zona horaria.
 *
 * El problema: los partidos se guardan en UTC, pero el usuario filtra y agrupa
 * por dia en SU zona horaria. Si comparamos "2025-03-15" contra un timestamp
 * UTC, un partido de las 22:00 de Buenos Aires (01:00 UTC del dia siguiente)
 * cae en el dia equivocado.
 *
 * La solucion correcta es convertir la clave de fecha local al instante UTC que
 * corresponde a la medianoche de esa zona. Como JS no expone el offset de una
 * zona directamente, lo derivamos comparando el resultado de Intl con el mismo
 * instante interpretado como UTC.
 */

const DEFAULT_TIMEZONE =
  process.env.DISPLAY_TIMEZONE?.trim() || "America/Argentina/Buenos_Aires";

/** Offset de la zona respecto de UTC, en minutos, para ese instante. */
export function timezoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const valueOf = (type: string): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number(part.value) : 0;
  };

  const asIfUtc = Date.UTC(
    valueOf("year"),
    valueOf("month") - 1,
    valueOf("day"),
    // Intl puede devolver "24" para medianoche en algunos entornos.
    valueOf("hour") % 24,
    valueOf("minute"),
    valueOf("second"),
  );

  return (asIfUtc - date.getTime()) / 60_000;
}

/**
 * Medianoche de `dateKey` ("AAAA-MM-DD") en la zona indicada, como ISO UTC.
 * Es el limite inferior (inclusive) de un rango de dias.
 */
export function startOfDayIso(
  dateKey: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  // Dos pasadas: la primera estima, la segunda corrige el offset cuando el
  // cambio de horario estacional cae justo en ese dia.
  let instant = naive - timezoneOffsetMinutes(new Date(naive), timeZone) * 60_000;
  instant = naive - timezoneOffsetMinutes(new Date(instant), timeZone) * 60_000;

  return new Date(instant).toISOString();
}

/**
 * Inicio del dia SIGUIENTE a `dateKey`. Se usa como limite superior exclusivo,
 * que es como se escribe un rango de dias sin errores de borde.
 */
export function endOfDayIso(
  dateKey: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const naiveNextDay = Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0);
  const dateKeyNext = new Date(naiveNextDay).toISOString().slice(0, 10);
  return startOfDayIso(dateKeyNext, timeZone);
}

export { DEFAULT_TIMEZONE };
