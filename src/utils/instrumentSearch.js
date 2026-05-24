import completeData from '../../complete.json'

// Cache the loaded data
let instrumentsCache = null

function loadInstruments() {
  if (!instrumentsCache) {
    instrumentsCache = Array.isArray(completeData) ? completeData : []
  }
  return instrumentsCache
}

/**
 * Search instruments by query string (matches trading_symbol, name)
 * Returns top 8 matches sorted by relevance
 */
export function searchInstruments(query) {
  if (!query || query.trim().length < 1) return []

  const instruments = loadInstruments()
  const q = query.toUpperCase().trim()

  // Filter and score matches
  const matches = instruments
    .filter(item => {
      const symbol = (item.trading_symbol || '').toUpperCase()
      const name = (item.name || '').toUpperCase()
      return symbol.includes(q) || name.includes(q)
    })
    .map(item => {
      // Score: exact match on trading_symbol gets highest score
      const symbol = (item.trading_symbol || '').toUpperCase()
      let score = 0
      
      if (symbol === q) score = 1000
      else if (symbol.startsWith(q)) score = 500
      else if (symbol.includes(q)) score = 100
      else score = 10

      return { ...item, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  return matches.map(({ score, ...item }) => ({
    instrumentKey: item.instrument_key,
    tradingSymbol: item.trading_symbol,
    symbol: item.trading_symbol,
    name: item.name,
    exchange: item.exchange,
    segment: item.segment,
  }))
}

/**
 * Get instrument by trading symbol (exact match)
 */
export function getInstrumentBySymbol(symbol) {
  const instruments = loadInstruments()
  const sym = symbol.toUpperCase().trim()
  const item = instruments.find(i => (i.trading_symbol || '').toUpperCase() === sym)
  if (!item) return null
  
  return {
    instrumentKey: item.instrument_key,
    tradingSymbol: item.trading_symbol,
    symbol: item.trading_symbol,
    name: item.name,
    exchange: item.exchange,
    segment: item.segment,
    isin: item.isin || null,
  }
}
