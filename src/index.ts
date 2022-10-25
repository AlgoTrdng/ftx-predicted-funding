import { serve } from "https://deno.land/std@0.149.0/http/server.ts"

import { fetchFuturesAndIndexOhlc, fetchSpotAndPerpMarkets, FtxOhlc } from "./ftx/index.ts"
import { checkRateLimit } from "./utils/rateLimiter.ts"

const {
  spotMarkets,
  perpMarkets,
} = await fetchSpotAndPerpMarkets()

type Market = {
  spotSymbol: string
  perpSymbol: string
  baseCurrency: string
  quoteCurrency: string
}

const markets = spotMarkets.reduce<Market[]>((merged, spotMarket) => {
  const {
    name: spotSymbol,
    baseCurrency,
    quoteCurrency,
  } = spotMarket
  const correspondingPerpMarket = perpMarkets.find(({ name }) => (
    name === `${baseCurrency}-PERP`
  ))

  if (!correspondingPerpMarket) {
    return merged
  }

  merged.push({
    perpSymbol: `${baseCurrency}-PERP`,
    spotSymbol,
    baseCurrency,
    quoteCurrency,
  })
  return merged
}, [])

type FundingRateData = {
  predictedFunding: number
  lastUpdated: number
}

const getFundingRates = (() => {
  const fundingRates = new Map<string, FundingRateData>()

  const calcTwap = (ohlc: FtxOhlc[]) => (
    ohlc.reduce((total, { close }) => (total + close), 0) / ohlc.length
  )
  
  const setPredictedFundingRates = async () => {
    for (const market of markets) {
      const {
        perpOhlc,
        indexOhlc,
      } = await fetchFuturesAndIndexOhlc(market.baseCurrency)
    
      const perpTwap = calcTwap(perpOhlc)
      const indexTwap = calcTwap(indexOhlc)
    
      const dailyFunding = (perpTwap - indexTwap) / indexTwap
      const hourlyFunding = (dailyFunding / 24) * 100
      fundingRates.set(market.perpSymbol, {
        predictedFunding: Math.round((hourlyFunding * 10 ** 5)) / 10 ** 5,
        lastUpdated: new Date().getTime(),
      })
    }
  }

  // Do not await, so server can listen immediately
  setPredictedFundingRates()
  // Fetching funding takes around 60 secs
  setInterval(setPredictedFundingRates, 120000)

  return () => fundingRates
})()

const PORT = Deno.env.get('PORT')
serve((req, connInfo) => {
  const {
    error: isRateLimited, ...res } = checkRateLimit(connInfo)

  if (isRateLimited) {
    return Response.json(res.body, {
      status: res.status,
      headers: res.headers,
    })
  }

  const url = new URL(req.url)

  const fundingRates = getFundingRates()

  const marketParam = url.searchParams.get('market')
  if (marketParam) {
    const data = fundingRates.get(marketParam)

    if (!data) {
      return Response.json({
        data: null,
      }, {
        headers: res.headers,
        status: 404,
      })
    }

    return Response.json({
      data,
    }, {
      headers: res.headers,
    })
  }

  const marketsParam = url.searchParams.get('markets')
  if (marketsParam) {
    const markets = marketsParam.split(',')
    const data = markets.reduce<FundingRateData[]>((_data, market) => {
      const currentFundingData = fundingRates.get(market)

      if (!currentFundingData) {
        return _data
      }

      _data.push(currentFundingData)
      return _data
    }, [])

    return Response.json({
      data,
    }, {
      headers: res.headers,
    })
  }

  return Response.json({
    data: Object.fromEntries([...fundingRates])
  }, {
    headers: res.headers,
  })
}, {
  hostname: Deno.env.get('APP_ENV') === 'dev' ? 'localhost' : '0.0.0.0',
  port: Number(PORT || 3002),
  onListen({ hostname, port }) {
    console.log(`Listening on: ${hostname}:${port}`)
  }
})
