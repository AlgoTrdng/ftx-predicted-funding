import { ConnInfo } from "https://deno.land/std@0.149.0/http/server.ts"

type UserData = {
  coolDownStart: false | number
  lastRequestTs: number
  remaining: number
}

// 5 req per 10 seconds
const limit = 5
const windowMs = 10_000
const coolDown = 60_000

const requests = new Map<string, UserData>()

type ResponseParams = {
  remaining: number
  status?: number
}

const createRes = (
  error: boolean,
  body: string | null,
  { remaining, status }: ResponseParams
) => {
  return {
    error,
    headers: {
      'x-rate-limit': limit.toString(),
      'x-rate-limit-remaining': remaining.toString(),
      'content-type': 'application/json'
    },
    status: status || 200,
    body: error ? { error: body } : body
  }
}

export const checkRateLimit = (connInfo: ConnInfo) => {
  const { remoteAddr } = connInfo

  if (remoteAddr.transport !== 'tcp' && remoteAddr.transport !== 'udp') {
    return createRes(true, 'Could not connect to server.', {
      remaining: limit,
      status: 500,
    })
  }

  const addr = remoteAddr.hostname
  const userData = requests.get(addr)
  const ts = new Date().getTime()

  if (
    !userData
    || (
      userData.lastRequestTs < ts - windowMs
      && userData.coolDownStart < ts - coolDown
    )
  ) {
    requests.set(addr, {
      coolDownStart: false,
      lastRequestTs: ts,
      remaining: limit - 1,
    })
    return createRes(false, null, { remaining: limit - 1 })
  }

  if (userData.remaining === 0) {
    return createRes(
      true,
      `Too many requests, please try again in ${
        Math.round((Number(userData.coolDownStart) - ts + coolDown) / 1000)
      } seconds.`,
      { remaining: 0, status: 429 },
    )
  }

  const { remaining } = userData
  const newRemaining = remaining - 1
  requests.set(addr, {
    coolDownStart: newRemaining === 0 ? ts : false,
    lastRequestTs: ts,
    remaining: newRemaining,
  })
  return createRes(false, null, {
    remaining: newRemaining,
  })
}
