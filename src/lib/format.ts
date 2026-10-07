const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const bsFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const kgFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

const tasaFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 6,
  maximumFractionDigits: 6,
})

export function formatUsd(n: number): string {
  return usdFormatter.format(n)
}

export function formatBs(n: number): string {
  return `Bs. ${bsFormatter.format(n)}`
}

export function formatKg(n: number): string {
  return `${kgFormatter.format(n)} kg`
}

export function formatTasa(n: number): string {
  return tasaFormatter.format(n)
}
