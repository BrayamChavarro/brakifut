import { getDb } from "@/infrastructure/db/db";
import { getLastSync } from "@/infrastructure/db/repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Chequeo de salud barato y estable. A diferencia del resto de las rutas, NO
 * llama a ensureData(): no siembra datos ni corre consultas de negocio. Solo
 * comprueba que SQLite responda.
 *
 * Es lo que usa el HEALTHCHECK del contenedor para decidir si esta sano, y lo
 * que consulta deploy.sh para confirmar que el despliegue quedo en pie. Por eso
 * tiene que ser rapido y no depender de que haya datos cargados.
 *
 * Devuelve 503 si la base no responde, para que el orquestador lo note.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    getDb().prepare("SELECT 1").get();

    return Response.json(
      {
        status: "ok",
        database: "ok",
        provider: process.env.FOOTBALL_PROVIDER?.trim() || "seed",
        lastSync: getLastSync(),
        uptimeSeconds: Math.round(process.uptime()),
        latencyMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // No se expone la ruta del archivo ni el mensaje crudo del driver: este
    // endpoint es publico y no debe filtrar rutas internas del servidor.
    return Response.json(
      {
        status: "error",
        database: "unreachable",
        message: error instanceof Error ? error.name : "Error desconocido",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
