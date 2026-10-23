import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 08-tasas: `undici` (scraping del BCV con CA propio) corre solo en el
  // servidor; se deja como paquete externo en vez de bundlearlo.
  serverExternalPackages: ["undici"],
  // 21-cotizaciones: las fuentes TTF de marca se leen con `fs` al renderizar
  // el PDF; se incluyen en el trazado de los route handlers que lo generan.
  outputFileTracingIncludes: {
    "/cotizaciones/*/pdf": ["./src/lib/pdf/fuentes/**/*"],
    "/c/*/pdf": ["./src/lib/pdf/fuentes/**/*"],
  },
};

export default nextConfig;
