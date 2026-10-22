"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MaterialIcon } from "./MaterialIcon";

/**
 * Boton de sincronizacion.
 *
 * Es el unico componente cliente del marco: necesita estado (cargando / error)
 * y disparar `router.refresh()` para volver a pedir los datos del servidor
 * despues de escribir en la base.
 */
export function SyncButton({ isDemoData }: { isDemoData: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSync() {
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const payload = (await response.json()) as {
        matchesUpserted?: number;
        provider?: string;
        error?: string;
      };

      if (!response.ok) {
        setIsError(true);
        setMessage(payload.error ?? "No se pudo sincronizar.");
        return;
      }

      setMessage(`${payload.matchesUpserted ?? 0} partidos actualizados.`);
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("No se pudo contactar al servidor.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={`hidden max-w-[22rem] truncate text-label-sm lg:block ${
            isError ? "text-error" : "text-primary-container"
          }`}
        >
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        title={
          isDemoData
            ? "Trae el historial real desde football-data.org"
            : "Vuelve a traer los datos del proveedor"
        }
        className="flex items-center gap-1.5 rounded-lg bg-surface-container-low px-3 py-1.5 text-label-md text-primary-container transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
      >
        <MaterialIcon
          name="sync"
          className={`text-[18px] ${isPending ? "animate-spin" : ""}`}
        />
        <span className="hidden sm:inline">
          {isPending ? "Sincronizando..." : "Sincronizar"}
        </span>
      </button>
    </div>
  );
}
