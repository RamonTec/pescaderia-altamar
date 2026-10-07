/**
 * Prueba del scraper del BCV (08-tasas): parsea el fixture guardado y, con
 * `--live`, descarga y parsea la página real.
 *
 *   npx tsx scripts/probar-scraper-bcv.ts          → fixture
 *   npx tsx scripts/probar-scraper-bcv.ts --live   → página real
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { obtenerTasasBcv, parsearPaginaBcv } from '../src/lib/tasas/bcvScraper'

function reportar(etiqueta: string, r: { usd: number; eur: number; fechaValor: string } | null): number {
  if (!r) {
    console.log(`${etiqueta}: SIN DATOS (falló el fetch o el parseo)`)
    return 1
  }
  console.log(`${etiqueta}: usd=${r.usd} eur=${r.eur} fechaValor=${r.fechaValor}`)
  return 0
}

async function main(): Promise<number> {
  if (process.argv.includes('--live')) {
    return reportar('live', await obtenerTasasBcv())
  }
  const html = await readFile(
    fileURLToPath(new URL('../src/lib/tasas/__fixtures__/bcv.html', import.meta.url)),
    'utf-8'
  )
  return reportar('fixture', parsearPaginaBcv(html))
}

main().then((code) => process.exit(code))
