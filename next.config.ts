import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 08-tasas: `undici` (scraping del BCV con CA propio) corre solo en el
  // servidor; se deja como paquete externo en vez de bundlearlo.
  serverExternalPackages: ["undici"],
  // 21-cotizaciones: las fuentes TTF de marca se leen con `fs` al renderizar
  // el PDF; se incluyen en el trazado de los route handlers que lo generan.
  // 21-cotizaciones: el enlace público no se indexa ni filtra el token por `Referer`.
  async headers() {
    return [
      {
        source: "/c/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/cotizaciones/*/pdf": ["./src/lib/pdf/fuentes/**/*"],
    "/c/*/pdf": ["./src/lib/pdf/fuentes/**/*"],
  },
};

export default nextConfig;
