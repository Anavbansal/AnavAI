// Instrument search utility
// Uses symbols.js (3286 NSE/BSE stocks) — complete.json has been removed

// SYMBOLS format: [symbol, name, type, instrumentKey]
// type: E=equity, I=index

export function searchInstruments(query) {
  if (!query || query.length < 1) return []
  const q = query.toUpperCase()
  
  // Dynamic import to keep bundle small
  return import('../data/symbols').then(({ SYMBOLS }) => {
    return SYMBOLS
      .filter(([sym, name]) => 
        sym.startsWith(q) || 
        sym.includes(q) || 
        name.toUpperCase().includes(q)
      )
      .slice(0, 20)
      .map(([sym, name, type, instrKey]) => ({
        symbol: sym,
        name,
        type,
        instrumentKey: instrKey,
        exchange: instrKey?.split('|')[0] || 'NSE',
      }))
  })
}

export function getInstrumentKey(symbol) {
  // This is synchronous — used for direct lookups
  // Full search use searchInstruments()
  return null // resolved server-side
}
