const FTX_API = 'https://ftx.com/api'

const ftxFetch = async <ReturnType>(endpoint: string, init?: RequestInit) => {
  const res = await fetch(`${FTX_API}${endpoint}`, init)
  const dataPromise = res.headers.get('content-type') === 'application/json' ? res.json() : res.text()
  if (!res.ok) {
    console.error('[FTX API ERROR]:', await dataPromise)
    return null
  }
  const data = await dataPromise
  if (data.success) {
    return data.result as ReturnType
  }
  console.error(data)
  return null
}

type FtxMarket = {
  name: string,
  baseCurrency?: string
  quoteCurrency?: string
  underlying?: string
}

export type SpotMarket = {
  name: string,
  baseCurrency: string
  quoteCurrency: string
}

export type FutureMarket = {
  name: string,
  baseCurrency: string
}

export const fetchSpotAndPerpMarkets = async () => {
  const res = await ftxFetch<FtxMarket[]>('/markets')
  if (!res) {
    // Exit because app can not start
    Deno.exit()
  }

  const spotMarkets: SpotMarket[] = []
  const perpMarkets: FutureMarket[] = []

  res.forEach(({
    name,
    baseCurrency,
    quoteCurrency,
    underlying,
  }) => {
    if (name.endsWith('-PERP') && underlying) {
      perpMarkets.push({
        name,
        baseCurrency: underlying,
      })
      return
    }

    if (name.endsWith('/USD') && baseCurrency && quoteCurrency) {
      spotMarkets.push({
        name,
        baseCurrency,
        quoteCurrency,
      })
    }
  })

  return {
    spotMarkets,
    perpMarkets,
  }
}

export type FtxOhlc = {
  close: number
  high: number
  low: number
  open: number
}

export const fetchFuturesAndIndexOhlc = async (baseCurrency: string) => {
  const ts = Math.round(new Date().getTime() / 1000)
  const params = new URLSearchParams({
    resolution: '60',
    start_time: (ts - 60 * 60).toString(),
  }).toString()

  const requestUrls = [
    `/markets/${baseCurrency}-PERP/candles?${params}`,
    `/indexes/${baseCurrency}/candles?${params}`
  ]

  try {
    const [
      perpOhlc,
      indexOhlc,
    ] = await Promise.all(requestUrls.map((reqPath) => (
      ftxFetch<FtxOhlc[]>(reqPath)
    )))

    if (!perpOhlc || !indexOhlc) {
      return null
    }

    return { perpOhlc, indexOhlc }
  } catch (error) {
    console.error(error)
    return null
  }
}
