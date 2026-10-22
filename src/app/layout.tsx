import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

import { getShellViewModel } from "@/application/queries";
import { AppShell } from "@/components/AppShell";

import "./globals.css";

/*
 * Fuentes autohospedadas con next/font: Next descarga las fuentes en tiempo de
 * build y las sirve desde el propio dominio. Evita una hoja de estilo externa
 * que bloquee el render y elimina el salto de layout (CLS) al cargar.
 *
 * Estas fuentes son las del prototipo de Stitch (Inter para el cuerpo,
 * Plus Jakarta Sans para los titulares).
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PitchPulse — Resultados e historial de fútbol",
    template: "%s · PitchPulse",
  },
  description:
    "Historial de resultados de fútbol, buscable por equipo, competición y fecha.",
};

// El contenido sale de una base local que cambia con cada sincronización:
// no se puede prerenderizar en el build.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getShellViewModel();

  return (
    <html lang="es" className={`${inter.variable} ${plusJakarta.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="bg-background font-sans text-on-surface antialiased">
        <AppShell shell={shell}>{children}</AppShell>
      </body>
    </html>
  );
}
