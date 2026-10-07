import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 08-tasas: `undici` (scraping del BCV con CA propio) corre solo en el
  // servidor; se deja como paquete externo en vez de bundlearlo.
  serverExternalPackages: ["undici"],
};

export default nextConfig;
