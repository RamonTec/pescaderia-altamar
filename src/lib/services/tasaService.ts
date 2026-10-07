import type { SupabaseClient } from '@supabase/supabase-js'
import type { FuenteTasa, MonedaTasa, OrigenTasa, Tasa, TasaOperacion, TasaVigente } from '@/types/domain'
import { createClient as crearClienteServidor } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fechaHoy } from '@/lib/format'
import { obtenerTasasBcv } from '@/lib/tasas/bcvScraper'
import { obtenerTasasDolarApi } from '@/lib/tasas/dolarApi'

/**
 * TasaService (SRP): obtención de tasas (BCV scraping → dolarapi → manual),
 * tasa vigente por fecha valor y procedencia de la tasa de cada operación
 * (08-tasas). Reemplaza al viejo `rateService`.
 *
 * - Las tasas automáticas se escriben con el cliente `service_role`
 *   (`admin.ts`): el cron no pasa por RLS de `authenticated`.
 * - `fecha` de cada `tasas` es la **fecha valor** (la que rige la tasa), no
 *   la de consulta: la vigente de un fin de semana arrastra la del viernes.
 */

/** Fuente de la referencial (la manual "del día" corrige una de estas). */
export type FuenteReferencial = 'bcv' | 'paralela'

/** Error de regla de negocio; `campo` permite marcarlo en el formulario. */
export class TasaError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'TasaError'
  }
}

// ============ actualizarTasas ============

export interface ResultadoActualizacion {
  fuente: FuenteReferencial
  moneda: MonedaTasa
  estado:
    | 'actualizado'
    | 'sin_cambios'
    | 'fallo_con_respaldo'
    | 'descartado_por_sanidad'
    | 'sin_datos'
    | 'error'
  valor_bs: number | null
  origen: OrigenTasa | null
  /** Discrepancia BCV/dolarapi, motivo del descarte o del fallo. */
  detalle: string | null
}

export interface ResumenActualizacion {
  /** Hoy (VET) en el momento de la actualización. */
  fecha: string
  resultados: ResultadoActualizacion[]
}

/** Sanidad: desvío máximo contra la última guardada de esa fuente/moneda. */
const DESVIO_MAX = 0.2
/** BCV y dolarapi: discrepancia que se registra (se guarda la del BCV). */
const DISCREPANCIA_MAX = 0.005
/** Tolerancia de redondeo de numeric(14,6) al comparar valores. */
const TOLERANCIA = 1e-6

const formatoFechaCaracas = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Caracas',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Fecha (YYYY-MM-DD, VET) de un timestamp ISO reportado por una fuente. */
function fechaCaracas(iso: string): string {
  return formatoFechaCaracas.format(new Date(iso))
}

async function ultimaTasaDe(
  db: SupabaseClient,
  fuente: FuenteTasa,
  moneda: MonedaTasa
): Promise<Tasa | null> {
  const { data } = await db
    .from('tasas')
    .select('*')
    .eq('fuente', fuente)
    .eq('moneda', moneda)
    .order('fecha', { ascending: false })
    .limit(1)
  return (data?.[0] as Tasa | undefined) ?? null
}

interface DatosGuardado {
  fecha: string
  fuente: FuenteReferencial
  moneda: MonedaTasa
  valor: number
  origen: OrigenTasa
  publicada_en: string | null
}

interface BanderasGuardado {
  /** El BCV no respondió y el valor vino de dolarapi. */
  falloBcv?: boolean
  /** Discrepancia BCV/dolarapi ya calculada (%). */
  discrepancia?: number | null
}

/**
 * Sanidad (≤ 0, desvío > 20 % contra la última guardada) + upsert contra
 * (fecha, fuente, moneda). Una manual del día con otro valor no se pisa con
 * una automática: la corrección del admin manda hasta el día siguiente.
 */
async function guardarConSanidad(
  db: SupabaseClient,
  forzar: boolean,
  hoy: string,
  datos: DatosGuardado,
  banderas: BanderasGuardado = {}
): Promise<ResultadoActualizacion> {
  const base = {
    fuente: datos.fuente,
    moneda: datos.moneda,
    valor_bs: datos.valor,
    origen: datos.origen,
  }
  const ultima = await ultimaTasaDe(db, datos.fuente, datos.moneda)

  // Sin `forzar`, si ya hay tasa de hoy (o de fecha valor futura) no se
  // golpea la fuente: es la obtención bajo demanda, no el cron.
  if (!forzar && ultima && ultima.fecha >= hoy) {
    return { ...base, estado: 'sin_cambios', detalle: null }
  }

  if (!(datos.valor > 0)) {
    return { ...base, estado: 'descartado_por_sanidad', detalle: `valor ${datos.valor} no positivo` }
  }
  if (ultima && Math.abs(datos.valor / Number(ultima.valor_bs) - 1) > DESVIO_MAX) {
    return {
      ...base,
      estado: 'descartado_por_sanidad',
      detalle: `valor ${datos.valor} difiere más de 20 % de la última guardada (${ultima.valor_bs} del ${ultima.fecha})`,
    }
  }

  const { data: existente } = await db
    .from('tasas')
    .select('*')
    .eq('fecha', datos.fecha)
    .eq('fuente', datos.fuente)
    .eq('moneda', datos.moneda)
    .maybeSingle()
  const previa = existente as Tasa | null
  if (previa) {
    if (Math.abs(Number(previa.valor_bs) - datos.valor) < TOLERANCIA) {
      return { ...base, estado: 'sin_cambios', detalle: null }
    }
    if (previa.origen === 'manual') {
      return {
        ...base,
        estado: 'sin_cambios',
        detalle: `se conserva la manual del ${previa.fecha} (${previa.valor_bs})`,
      }
    }
  }

  const { error } = await db.from('tasas').upsert(
    {
      fecha: datos.fecha,
      fuente: datos.fuente,
      moneda: datos.moneda,
      valor_bs: datos.valor,
      origen: datos.origen,
      registrada_por: null,
      publicada_en: datos.publicada_en,
    },
    { onConflict: 'fecha,fuente,moneda' }
  )
  if (error) {
    return { ...base, estado: 'error', detalle: error.message }
  }
  return {
    ...base,
    estado: banderas.falloBcv ? 'fallo_con_respaldo' : 'actualizado',
    detalle:
      banderas.discrepancia != null
        ? `BCV y dolarapi difieren ${banderas.discrepancia.toFixed(2)} %: se guardó la del BCV`
        : banderas.falloBcv
          ? 'el BCV no respondió: se guardó el espejo de dolarapi'
          : null,
  }
}

const MONEDAS = ['USD', 'EUR'] as const

/**
 * Cadena de obtención (08-tasas): oficial por scraping del BCV con dolarapi
 * de respaldo; paralela solo por dolarapi. Devuelve un resumen por fuente y
 * moneda para el toast de la UI ("Actualizar ahora") y el cron.
 */
export async function actualizarTasas(opciones?: { forzar?: boolean }): Promise<ResumenActualizacion> {
  const forzar = opciones?.forzar ?? false
  const db = createAdminClient()
  const hoy = fechaHoy()
  const resultados: ResultadoActualizacion[] = []

  const bcv = await obtenerTasasBcv()
  const dolarapi = await obtenerTasasDolarApi()

  // ---- Oficial (fuente 'bcv'): BCV scraping; si falla, dolarapi oficial ----
  if (bcv) {
    for (const moneda of MONEDAS) {
      const valor = moneda === 'USD' ? bcv.usd : bcv.eur
      const espejo = dolarapi?.oficial ? (moneda === 'USD' ? dolarapi.oficial.usd : dolarapi.oficial.eur) : null
      const discrepancia =
        espejo != null && Math.abs(valor / espejo - 1) > DISCREPANCIA_MAX
          ? Math.abs(valor / espejo - 1) * 100
          : null
      resultados.push(
        await guardarConSanidad(
          db,
          forzar,
          hoy,
          {
            fecha: bcv.fechaValor,
            fuente: 'bcv',
            moneda,
            valor,
            origen: 'bcv_scraping',
            publicada_en: null,
          },
          { discrepancia }
        )
      )
    }
  } else if (dolarapi?.oficial) {
    const fecha = fechaCaracas(dolarapi.oficial.fechaActualizacion)
    for (const moneda of MONEDAS) {
      resultados.push(
        await guardarConSanidad(
          db,
          forzar,
          hoy,
          {
            fecha,
            fuente: 'bcv',
            moneda,
            valor: moneda === 'USD' ? dolarapi.oficial.usd : dolarapi.oficial.eur,
            origen: 'dolarapi',
            publicada_en: dolarapi.oficial.fechaActualizacion,
          },
          { falloBcv: true }
        )
      )
    }
  } else {
    for (const moneda of MONEDAS) {
      resultados.push({
        fuente: 'bcv',
        moneda,
        estado: 'sin_datos',
        valor_bs: null,
        origen: null,
        detalle: 'ni el BCV ni dolarapi respondieron',
      })
    }
  }

  // ---- Paralela: única fuente es dolarapi ----
  if (dolarapi?.paralelo) {
    const fecha = fechaCaracas(dolarapi.paralelo.fechaActualizacion)
    for (const moneda of MONEDAS) {
      resultados.push(
        await guardarConSanidad(db, forzar, hoy, {
          fecha,
          fuente: 'paralela',
          moneda,
          valor: moneda === 'USD' ? dolarapi.paralelo.usd : dolarapi.paralelo.eur,
          origen: 'dolarapi',
          publicada_en: dolarapi.paralelo.fechaActualizacion,
        })
      )
    }
  } else {
    for (const moneda of MONEDAS) {
      resultados.push({
        fuente: 'paralela',
        moneda,
        estado: 'sin_datos',
        valor_bs: null,
        origen: null,
        detalle: 'dolarapi no respondió la tasa paralela',
      })
    }
  }

  return { fecha: hoy, resultados }
}

// ============ Tasa vigente ============

/**
 * Tasa vigente para una fecha: la de mayor `fecha ≤ fecha` para esa fuente y
 * moneda (la RPC `tasa_vigente` prefiere una manual de la misma fecha).
 * `arrastrada` indica que la fecha valor es anterior a la pedida (fin de
 * semana / feriado).
 */
export async function getTasaVigente(
  fecha: string,
  fuente: FuenteReferencial,
  moneda: MonedaTasa = 'USD',
  db?: SupabaseClient
): Promise<TasaVigente | null> {
  const client = db ?? (await crearClienteServidor())
  const { data, error } = await client.rpc('tasa_vigente', {
    p_fecha: fecha,
    p_fuente: fuente,
    p_moneda: moneda,
  })
  if (error) throw error
  if (!data) return null
  const tasa = data as Tasa
  return { tasa, arrastrada: tasa.fecha < fecha, fecha_valor: tasa.fecha }
}

// ============ Obtención bajo demanda ============

/** Caché de fallo: no golpear la fuente en cada render si no responde. */
const CACHE_FALLO_MS = 15 * 60 * 1000
const enCurso = new Map<FuenteReferencial, Promise<void>>()
const falloHasta = new Map<FuenteReferencial, number>()

/**
 * Si la última tasa guardada de la fuente es de una fecha anterior a hoy,
 * dispara `actualizarTasas` en el servidor. Deduplicación en memoria (una
 * sola obtención concurrente por fuente) y caché de 15 min si sigue sin
 * haber tasa de hoy.
 */
export async function asegurarTasaDeHoy(fuente: FuenteReferencial): Promise<void> {
  const db = await crearClienteServidor()
  const hoy = fechaHoy()
  const ultima = await ultimaTasaDe(db, fuente, 'USD')
  if (ultima && ultima.fecha >= hoy) return
  if ((falloHasta.get(fuente) ?? 0) > Date.now()) return

  let tarea = enCurso.get(fuente)
  if (!tarea) {
    tarea = actualizarTasas()
      .then(async () => {
        const despues = await ultimaTasaDe(db, fuente, 'USD')
        if (!despues || despues.fecha < hoy) {
          falloHasta.set(fuente, Date.now() + CACHE_FALLO_MS)
        }
      })
      .catch(() => {
        falloHasta.set(fuente, Date.now() + CACHE_FALLO_MS)
      })
      .finally(() => {
        enCurso.delete(fuente)
      })
    enCurso.set(fuente, tarea)
  }
  await tarea
}

/** Vigentes de hoy para las tarjetas de `/tasas` y el indicador de la barra. */
export interface TasasHoy {
  bcv: { usd: TasaVigente | null; eur: TasaVigente | null }
  paralela: { usd: TasaVigente | null; eur: TasaVigente | null }
  /** Config de tasas de `config_negocio` (08-tasas Fase D). */
  config: { fuente_tasa_default: FuenteReferencial; umbral_desviacion_tasa_pct: number }
}

/**
 * Config de tasas de `config_negocio`: fuente referencial por defecto y
 * umbral de desviación % para confirmar una tasa manual (08-tasas).
 */
export async function getConfigTasas(db?: SupabaseClient): Promise<TasasHoy['config']> {
  const client = db ?? (await crearClienteServidor())
  const { data } = await client
    .from('config_negocio')
    .select('fuente_tasa_default, umbral_desviacion_tasa_pct')
    .limit(1)
  const fila = (data?.[0] as
    | { fuente_tasa_default?: string; umbral_desviacion_tasa_pct?: number | string }
    | undefined) ?? undefined
  return {
    fuente_tasa_default: fila?.fuente_tasa_default === 'paralela' ? 'paralela' : 'bcv',
    umbral_desviacion_tasa_pct: Number(fila?.umbral_desviacion_tasa_pct ?? 10),
  }
}

export async function getTasasVigentesHoy(db?: SupabaseClient): Promise<TasasHoy> {
  const client = db ?? (await crearClienteServidor())
  await Promise.all([asegurarTasaDeHoy('bcv'), asegurarTasaDeHoy('paralela')])
  const hoy = fechaHoy()
  const [usdBcv, eurBcv, usdPar, eurPar, config] = await Promise.all([
    getTasaVigente(hoy, 'bcv', 'USD', client),
    getTasaVigente(hoy, 'bcv', 'EUR', client),
    getTasaVigente(hoy, 'paralela', 'USD', client),
    getTasaVigente(hoy, 'paralela', 'EUR', client),
    getConfigTasas(client),
  ])
  return { bcv: { usd: usdBcv, eur: eurBcv }, paralela: { usd: usdPar, eur: eurPar }, config }
}

// ============ Tasa manual del día (admin) ============

/**
 * Corrige o completa la referencial de una fecha: upsert con el cliente del
 * servidor autenticado (RLS: solo admin pasa). `origen: 'manual'` y el
 * usuario actual; la RPC `tasa_vigente` la prefiere sobre la de la fuente en
 * esa misma fecha.
 */
export async function registrarTasaManualDelDia(input: {
  fecha: string
  fuente: FuenteReferencial
  moneda: MonedaTasa
  valor: number
}): Promise<Tasa> {
  if (!(input.valor > 0)) throw new TasaError('La tasa debe ser mayor que 0', 'valor')
  const db = await crearClienteServidor()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) throw new TasaError('Debes tener la sesión iniciada')

  const { data, error } = await db
    .from('tasas')
    .upsert(
      {
        fecha: input.fecha,
        fuente: input.fuente,
        moneda: input.moneda,
        valor_bs: input.valor,
        origen: 'manual',
        registrada_por: user.id,
        publicada_en: new Date().toISOString(),
      },
      { onConflict: 'fecha,fuente,moneda' }
    )
    .select()
    .single()
  if (error) throw new TasaError(error.message)
  return data as Tasa
}

// ============ Historial ============

export interface FiltrosTasas {
  fuente?: FuenteTasa
  moneda?: MonedaTasa
  desde?: string
  hasta?: string
  limit?: number
}

export async function listTasas(filtros: FiltrosTasas = {}, db?: SupabaseClient): Promise<Tasa[]> {
  const client = db ?? (await crearClienteServidor())
  let query = client.from('tasas').select('*').order('fecha', { ascending: false })
  if (filtros.fuente) query = query.eq('fuente', filtros.fuente)
  if (filtros.moneda) query = query.eq('moneda', filtros.moneda)
  if (filtros.desde) query = query.gte('fecha', filtros.desde)
  if (filtros.hasta) query = query.lte('fecha', filtros.hasta)
  const { data, error } = await query.limit(filtros.limit ?? 100)
  if (error) throw error
  return data as Tasa[]
}

// ============ Tasa de cada operación ============

export interface EntradaTasaOperacion {
  tasa_origen: 'referencial' | 'manual'
  /** Fuente de la referencial; si falta, la default de `config_negocio`. */
  tasa_fuente?: FuenteReferencial | null
  /** Valor final; requerido (y > 0) si `tasa_origen` es manual. */
  tasa?: number
}

export interface ResultadoTasaOperacion {
  tasa_operacion?: TasaOperacion
  /** El cliente pidió referencial pero la vigente del servidor es otra. */
  aviso?: 'referencial_cambio'
  /** No hay ninguna referencial disponible: la UI debe exigir tasa manual. */
  error?: 'sin_referencial'
}

async function fuenteDefault(db: SupabaseClient): Promise<FuenteReferencial> {
  const { data } = await db.from('config_negocio').select('fuente_tasa_default').limit(1)
  const fuente = (data?.[0] as { fuente_tasa_default?: string } | undefined)?.fuente_tasa_default
  return fuente === 'paralela' ? 'paralela' : 'bcv'
}

/**
 * Resuelve la tasa de una operación (compra, factura o abono): recalcula la
 * referencial en el servidor para la fecha/fuente indicadas (nunca se confía
 * en el valor del cliente) o valida la manual. La usan todos los servicios
 * que guardan una tasa.
 */
export async function resolverTasaOperacion(
  input: EntradaTasaOperacion,
  fecha: string,
  db?: SupabaseClient,
  /** Fuente ya resuelta por el invocador (evita re-leer `config_negocio`). */
  fuenteDefaultConocida?: FuenteReferencial
): Promise<ResultadoTasaOperacion> {
  const client = db ?? (await crearClienteServidor())
  const fuente = input.tasa_fuente ?? fuenteDefaultConocida ?? (await fuenteDefault(client))
  const vigente = await getTasaVigente(fecha, fuente, 'USD', client)

  if (input.tasa_origen === 'referencial') {
    if (!vigente) return { error: 'sin_referencial' }
    const valorServidor = Number(vigente.tasa.valor_bs)
    const aviso =
      input.tasa != null && Math.abs(input.tasa - valorServidor) > TOLERANCIA
        ? 'referencial_cambio'
        : undefined
    return {
      tasa_operacion: {
        tasa_origen: 'referencial',
        tasa_fuente: fuente,
        tasa_referencial: valorServidor,
        tasa_snapshot: valorServidor,
      },
      aviso,
    }
  }

  if (!(input.tasa && input.tasa > 0)) {
    throw new TasaError('La tasa manual debe ser mayor que 0', 'tasa')
  }
  return {
    tasa_operacion: {
      tasa_origen: 'manual',
      tasa_fuente: input.tasa_fuente ?? (vigente ? fuente : null),
      tasa_referencial: vigente ? Number(vigente.tasa.valor_bs) : null,
      tasa_snapshot: input.tasa,
    },
  }
}
