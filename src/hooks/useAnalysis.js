import { useState, useCallback } from 'react'
import { analyzeSymbol } from '../services/marketData'

export function useAnalysis() {
  const [state, setState] = useState({
    data: null,
    ai: null,
    loading: false,
    error: null,
  })

  const analyze = useCallback(async (symbol, timeframe) => {
    if (!symbol) return
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await analyzeSymbol(symbol, timeframe)
      const ai = data.ai
      setState({ data, ai, loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e.message }))
    }
  }, [])

  return { ...state, analyze }
}
