# FTX Predicted funding rates

- This API returns predicted funding rates updated every 2 mins

## Routes

```
GET /
```

- Without params return funding rates from all markets

### Params

#### `market`
- type: string
- Returns funding rate of corresponding market, null if not found

#### `markets`
- type: string of market symbols separated with comma, ex: SOL-PERP,BTC-PERP
- Return array of funding rates of corresponding markets
