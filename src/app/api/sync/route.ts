import { runSync } from "@/application/sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync
 *
 * Dispara la sincronizacion contra el proveedor configurado. Es el unico
 * endpoint que escribe: el resto de la lectura la hacen los componentes de
 * servidor llamando directo a la capa de aplicacion.
 */
export async function POST() {
  try {
    const result = await runSync();
    return Response.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado al sincronizar.";

    // 401/403 son errores de configuracion del usuario, no del servidor.
    const status = /FOOTBALL_API_KEY/.test(message) ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
}
