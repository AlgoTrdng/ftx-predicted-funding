const FTX_API = 'https://ftx.com/api'

type FtxResponse<T> = {
  success: boolean
  result: T
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
  const res = await (
    await fetch(`${FTX_API}/markets`)
  ).json() as FtxResponse<FtxMarket[]>

  const spotMarkets: SpotMarket[] = []
  const perpMarkets: FutureMarket[] = []

  res.result.forEach(({
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
  const ts = new Date().getTime() / 1000
  const params = new URLSearchParams({
    resolution: '60',
    start_time: (ts - 60 * 60).toString(),
  }).toString()

  const requestUrls = [
    `/markets/${baseCurrency}-PERP/candles?${params}`,
    `/indexes/${baseCurrency}/candles?${params}`
  ]

  const [
    perpOhlc,
    indexOhlc,
  ] = await Promise.all(requestUrls.map((reqPath) => (
    fetch(`${FTX_API}${reqPath}`).then((res) => res.json())
  ))) as Array<FtxResponse<FtxOhlc[]>>

  return {
    perpOhlc: perpOhlc.result,
    indexOhlc: indexOhlc.result,
  }
}
