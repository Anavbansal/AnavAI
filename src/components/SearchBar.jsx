import React, { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../config'

// ─── Complete local symbol DB — 200+ stocks ───────────────────────────────────
const SYMBOLS = [
  // Indices
  {s:'NIFTY',     n:'Nifty 50 Index',              e:'NSE', seg:'INDEX', k:'NSE_INDEX|Nifty 50'},
  {s:'BANKNIFTY', n:'Nifty Bank Index',             e:'NSE', seg:'INDEX', k:'NSE_INDEX|Nifty Bank'},
  {s:'FINNIFTY',  n:'Nifty Financial Services',     e:'NSE', seg:'INDEX', k:'NSE_INDEX|Nifty Fin Service'},
  {s:'MIDCPNIFTY',n:'Nifty Midcap Select',          e:'NSE', seg:'INDEX', k:'NSE_INDEX|NIFTY MID SELECT'},
  {s:'SENSEX',    n:'S&P BSE Sensex',               e:'BSE', seg:'INDEX', k:'BSE_INDEX|SENSEX'},
  {s:'BANKEX',    n:'BSE Bankex',                   e:'BSE', seg:'INDEX', k:'BSE_INDEX|BANKEX'},
  // Nifty 50
  {s:'RELIANCE',  n:'Reliance Industries',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE002A01018'},
  {s:'TCS',       n:'Tata Consultancy Services',    e:'NSE', seg:'EQ', k:'NSE_EQ|INE467B01029'},
  {s:'HDFCBANK',  n:'HDFC Bank',                    e:'NSE', seg:'EQ', k:'NSE_EQ|INE040A01034'},
  {s:'INFY',      n:'Infosys',                      e:'NSE', seg:'EQ', k:'NSE_EQ|INE009A01021'},
  {s:'ICICIBANK', n:'ICICI Bank',                   e:'NSE', seg:'EQ', k:'NSE_EQ|INE090A01021'},
  {s:'HINDUNILVR',n:'Hindustan Unilever',           e:'NSE', seg:'EQ', k:'NSE_EQ|INE030A01027'},
  {s:'ITC',       n:'ITC Ltd',                      e:'NSE', seg:'EQ', k:'NSE_EQ|INE154A01025'},
  {s:'SBIN',      n:'State Bank of India',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE062A01020'},
  {s:'BHARTIARTL',n:'Bharti Airtel',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE397D01024'},
  {s:'KOTAKBANK', n:'Kotak Mahindra Bank',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE237A01028'},
  {s:'LT',        n:'Larsen & Toubro',              e:'NSE', seg:'EQ', k:'NSE_EQ|INE018A01030'},
  {s:'HCLTECH',   n:'HCL Technologies',             e:'NSE', seg:'EQ', k:'NSE_EQ|INE860A01027'},
  {s:'BAJFINANCE',n:'Bajaj Finance',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE296A01024'},
  {s:'ASIANPAINT',n:'Asian Paints',                 e:'NSE', seg:'EQ', k:'NSE_EQ|INE021A01026'},
  {s:'MARUTI',    n:'Maruti Suzuki',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE585B01010'},
  {s:'ADANIENT',  n:'Adani Enterprises',            e:'NSE', seg:'EQ', k:'NSE_EQ|INE423A01024'},
  {s:'AXISBANK',  n:'Axis Bank',                    e:'NSE', seg:'EQ', k:'NSE_EQ|INE238A01034'},
  {s:'WIPRO',     n:'Wipro',                        e:'NSE', seg:'EQ', k:'NSE_EQ|INE075A01022'},
  {s:'ULTRACEMCO',n:'UltraTech Cement',             e:'NSE', seg:'EQ', k:'NSE_EQ|INE481G01011'},
  {s:'TITAN',     n:'Titan Company',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE280A01028'},
  {s:'BAJAJFINSV',n:'Bajaj Finserv',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE918I01026'},
  {s:'NESTLEIND', n:'Nestle India',                 e:'NSE', seg:'EQ', k:'NSE_EQ|INE239A01024'},
  {s:'SUNPHARMA', n:'Sun Pharmaceutical',           e:'NSE', seg:'EQ', k:'NSE_EQ|INE044A01036'},
  {s:'TECHM',     n:'Tech Mahindra',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE669C01036'},
  {s:'ONGC',      n:'Oil & Natural Gas Corp',       e:'NSE', seg:'EQ', k:'NSE_EQ|INE213A01029'},
  {s:'TATAMOTORS',n:'Tata Motors',                  e:'NSE', seg:'EQ', k:'NSE_EQ|INE155A01022'},
  {s:'NTPC',      n:'NTPC',                         e:'NSE', seg:'EQ', k:'NSE_EQ|INE733E01010'},
  {s:'POWERGRID', n:'Power Grid Corp',              e:'NSE', seg:'EQ', k:'NSE_EQ|INE752E01010'},
  {s:'INDUSINDBK',n:'IndusInd Bank',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE095A01012'},
  {s:'COALINDIA', n:'Coal India',                   e:'NSE', seg:'EQ', k:'NSE_EQ|INE522F01014'},
  {s:'TATASTEEL', n:'Tata Steel',                   e:'NSE', seg:'EQ', k:'NSE_EQ|INE081A01020'},
  {s:'GRASIM',    n:'Grasim Industries',            e:'NSE', seg:'EQ', k:'NSE_EQ|INE047A01021'},
  {s:'ADANIPORTS',n:'Adani Ports & SEZ',            e:'NSE', seg:'EQ', k:'NSE_EQ|INE742F01042'},
  {s:'DRREDDY',   n:"Dr Reddy's Laboratories",      e:'NSE', seg:'EQ', k:'NSE_EQ|INE089A01031'},
  {s:'DIVISLAB',  n:"Divi's Laboratories",          e:'NSE', seg:'EQ', k:'NSE_EQ|INE361B01024'},
  {s:'CIPLA',     n:'Cipla',                        e:'NSE', seg:'EQ', k:'NSE_EQ|INE059A01026'},
  {s:'APOLLOHOSP',n:'Apollo Hospitals',             e:'NSE', seg:'EQ', k:'NSE_EQ|INE437A01024'},
  {s:'JSWSTEEL',  n:'JSW Steel',                    e:'NSE', seg:'EQ', k:'NSE_EQ|INE019A01038'},
  {s:'EICHERMOT', n:'Eicher Motors',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE066A01021'},
  {s:'BPCL',      n:'Bharat Petroleum',             e:'NSE', seg:'EQ', k:'NSE_EQ|INE029A01011'},
  {s:'BRITANNIA', n:'Britannia Industries',         e:'NSE', seg:'EQ', k:'NSE_EQ|INE216A01030'},
  {s:'HEROMOTOCO',n:'Hero MotoCorp',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE158A01026'},
  {s:'HINDALCO',  n:'Hindalco Industries',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE038A01020'},
  // Nifty Next 50 & Popular
  {s:'VEDL',      n:'Vedanta',                      e:'NSE', seg:'EQ', k:'NSE_EQ|INE205A01025'},
  {s:'TATAPOWER', n:'Tata Power',                   e:'NSE', seg:'EQ', k:'NSE_EQ|INE245A01021'},
  {s:'IRCTC',     n:'Indian Railway Catering',      e:'NSE', seg:'EQ', k:'NSE_EQ|INE335Y01020'},
  {s:'ZOMATO',    n:'Zomato',                       e:'NSE', seg:'EQ', k:'NSE_EQ|INE758T01015'},
  {s:'PAYTM',     n:'One97 Communications',         e:'NSE', seg:'EQ', k:'NSE_EQ|INE982J01020'},
  {s:'NYKAA',     n:'FSN E-Commerce (Nykaa)',       e:'NSE', seg:'EQ', k:'NSE_EQ|INE388Y01029'},
  {s:'DMART',     n:'Avenue Supermarts (DMart)',    e:'NSE', seg:'EQ', k:'NSE_EQ|INE192R01011'},
  {s:'HAVELLS',   n:'Havells India',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE176B01034'},
  {s:'DIXON',     n:'Dixon Technologies',           e:'NSE', seg:'EQ', k:'NSE_EQ|INE935N01020'},
  {s:'POLYCAB',   n:'Polycab India',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE455K01017'},
  {s:'TRENT',     n:'Trent',                        e:'NSE', seg:'EQ', k:'NSE_EQ|INE849A01020'},
  {s:'LTIM',      n:'LTIMindtree',                  e:'NSE', seg:'EQ', k:'NSE_EQ|INE214T01019'},
  {s:'PIDILITIND',n:'Pidilite Industries',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE318A01026'},
  {s:'PERSISTENT',n:'Persistent Systems',           e:'NSE', seg:'EQ', k:'NSE_EQ|INE262H01021'},
  {s:'MPHASIS',   n:'Mphasis',                      e:'NSE', seg:'EQ', k:'NSE_EQ|INE356A01018'},
  {s:'COFORGE',   n:'Coforge',                      e:'NSE', seg:'EQ', k:'NSE_EQ|INE591G01017'},
  {s:'KPITTECH',  n:'KPIT Technologies',            e:'NSE', seg:'EQ', k:'NSE_EQ|INE836A01035'},
  {s:'OFSS',      n:'Oracle Financial Services',    e:'NSE', seg:'EQ', k:'NSE_EQ|INE881D01027'},
  {s:'IRFC',      n:'Indian Railway Finance Corp',  e:'NSE', seg:'EQ', k:'NSE_EQ|INE053F01010'},
  {s:'PFC',       n:'Power Finance Corp',           e:'NSE', seg:'EQ', k:'NSE_EQ|INE134E01011'},
  {s:'RECLTD',    n:'REC',                          e:'NSE', seg:'EQ', k:'NSE_EQ|INE020B01018'},
  {s:'IOC',       n:'Indian Oil Corp',              e:'NSE', seg:'EQ', k:'NSE_EQ|INE242A01010'},
  {s:'HAL',       n:'Hindustan Aeronautics',        e:'NSE', seg:'EQ', k:'NSE_EQ|INE066F01012'},
  {s:'BEL',       n:'Bharat Electronics',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE263A01024'},
  {s:'BHEL',      n:'Bharat Heavy Electricals',    e:'NSE', seg:'EQ', k:'NSE_EQ|INE257A01026'},
  {s:'SAIL',      n:'Steel Authority of India',    e:'NSE', seg:'EQ', k:'NSE_EQ|INE114A01011'},
  {s:'NHPC',      n:'NHPC',                         e:'NSE', seg:'EQ', k:'NSE_EQ|INE848E01016'},
  {s:'SJVN',      n:'SJVN',                         e:'NSE', seg:'EQ', k:'NSE_EQ|INE002L01015'},
  {s:'RVNL',      n:'Rail Vikas Nigam',             e:'NSE', seg:'EQ', k:'NSE_EQ|INE415G01027'},
  {s:'CANBK',     n:'Canara Bank',                  e:'NSE', seg:'EQ', k:'NSE_EQ|INE476A01014'},
  {s:'BANKBARODA',n:'Bank of Baroda',               e:'NSE', seg:'EQ', k:'NSE_EQ|INE028A01039'},
  {s:'UNIONBANK', n:'Union Bank of India',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE692A01016'},
  {s:'PNB',       n:'Punjab National Bank',         e:'NSE', seg:'EQ', k:'NSE_EQ|INE160A01022'},
  {s:'FEDERALBNK',n:'Federal Bank',                 e:'NSE', seg:'EQ', k:'NSE_EQ|INE171A01029'},
  {s:'IDFCFIRSTB',n:'IDFC First Bank',              e:'NSE', seg:'EQ', k:'NSE_EQ|INE092T01019'},
  {s:'BANDHANBNK',n:'Bandhan Bank',                 e:'NSE', seg:'EQ', k:'NSE_EQ|INE545U01014'},
  {s:'CHOLAFIN',  n:'Cholamandalam Investment',    e:'NSE', seg:'EQ', k:'NSE_EQ|INE121A01024'},
  {s:'MUTHOOTFIN',n:'Muthoot Finance',              e:'NSE', seg:'EQ', k:'NSE_EQ|INE414G01012'},
  {s:'LICHSGFIN', n:'LIC Housing Finance',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE115A01026'},
  {s:'M&M',       n:'Mahindra & Mahindra',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE101A01026'},
  {s:'ASHOKLEY',  n:'Ashok Leyland',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE208A01029'},
  {s:'TVSMOTOR',  n:'TVS Motor Company',            e:'NSE', seg:'EQ', k:'NSE_EQ|INE494B01023'},
  {s:'BAJAJ-AUTO',n:'Bajaj Auto',                   e:'NSE', seg:'EQ', k:'NSE_EQ|INE917I01010'},
  {s:'MRF',       n:'MRF',                          e:'NSE', seg:'EQ', k:'NSE_EQ|INE883A01011'},
  {s:'APOLLOTYRE',n:'Apollo Tyres',                 e:'NSE', seg:'EQ', k:'NSE_EQ|INE438A01022'},
  {s:'BALKRISIND',n:'Balkrishna Industries',        e:'NSE', seg:'EQ', k:'NSE_EQ|INE787D01026'},
  {s:'AMBUJACEM', n:'Ambuja Cements',               e:'NSE', seg:'EQ', k:'NSE_EQ|INE079A01024'},
  {s:'ACCLTD',    n:'ACC',                          e:'NSE', seg:'EQ', k:'NSE_EQ|INE012A01025'},
  {s:'SHREECEM',  n:'Shree Cement',                 e:'NSE', seg:'EQ', k:'NSE_EQ|INE070A01015'},
  {s:'RAMCOCEM',  n:'Ramco Cements',                e:'NSE', seg:'EQ', k:'NSE_EQ|INE331A01037'},
  {s:'TORNTPHARM',n:'Torrent Pharmaceuticals',      e:'NSE', seg:'EQ', k:'NSE_EQ|INE685A01028'},
  {s:'AUROPHARMA',n:'Aurobindo Pharma',             e:'NSE', seg:'EQ', k:'NSE_EQ|INE406A01037'},
  {s:'LUPIN',     n:'Lupin',                        e:'NSE', seg:'EQ', k:'NSE_EQ|INE326A01037'},
  {s:'BIOCON',    n:'Biocon',                       e:'NSE', seg:'EQ', k:'NSE_EQ|INE376G01013'},
  {s:'ALKEM',     n:'Alkem Laboratories',           e:'NSE', seg:'EQ', k:'NSE_EQ|INE540L01014'},
  {s:'MAXHEALTH', n:'Max Healthcare',               e:'NSE', seg:'EQ', k:'NSE_EQ|INE027H01010'},
  {s:'FORTIS',    n:'Fortis Healthcare',            e:'NSE', seg:'EQ', k:'NSE_EQ|INE401H01019'},
  {s:'LALPATHLAB',n:'Dr Lal PathLabs',              e:'NSE', seg:'EQ', k:'NSE_EQ|INE600L01024'},
  {s:'METROPOLIS',n:'Metropolis Healthcare',        e:'NSE', seg:'EQ', k:'NSE_EQ|INE688V01015'},
  {s:'ABCAPITAL', n:'Aditya Birla Capital',         e:'NSE', seg:'EQ', k:'NSE_EQ|INE674K01013'},
  {s:'ABFRL',     n:'Aditya Birla Fashion',         e:'NSE', seg:'EQ', k:'NSE_EQ|INE647O01011'},
  {s:'PAGEIND',   n:'Page Industries (Jockey)',     e:'NSE', seg:'EQ', k:'NSE_EQ|INE628A01036'},
  {s:'MANYAVAR',  n:'Vedant Fashions (Manyavar)',   e:'NSE', seg:'EQ', k:'NSE_EQ|INE825V01022'},
  {s:'INDHOTEL',  n:'Indian Hotels (Taj)',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE053A01029'},
  {s:'LEMONTREE', n:'Lemon Tree Hotels',            e:'NSE', seg:'EQ', k:'NSE_EQ|INE970X01018'},
  {s:'JUBLFOOD',  n:'Jubilant FoodWorks (Dominos)', e:'NSE', seg:'EQ', k:'NSE_EQ|INE797F01012'},
  {s:'DEVYANI',   n:'Devyani International (KFC)',  e:'NSE', seg:'EQ', k:'NSE_EQ|INE741K01010'},
  {s:'NAUKRI',    n:'Info Edge (Naukri.com)',       e:'NSE', seg:'EQ', k:'NSE_EQ|INE663F01024'},
  {s:'JUSTDIAL',  n:'Just Dial',                   e:'NSE', seg:'EQ', k:'NSE_EQ|INE599M01018'},
  {s:'POLICYBZR', n:'PB Fintech (PolicyBazaar)',    e:'NSE', seg:'EQ', k:'NSE_EQ|INE417T01026'},
  {s:'CDSL',      n:'Central Depository Services', e:'NSE', seg:'EQ', k:'NSE_EQ|INE736A01011'},
  {s:'BSE',       n:'BSE (Bombay Stock Exchange)', e:'NSE', seg:'EQ', k:'NSE_EQ|INE118H01025'},
  {s:'MCX',       n:'Multi Commodity Exchange',    e:'NSE', seg:'EQ', k:'NSE_EQ|INE745G01035'},
  {s:'ANGELONE',  n:'Angel One',                   e:'NSE', seg:'EQ', k:'NSE_EQ|INE732I01013'},
  {s:'MOTILALOFS',n:'Motilal Oswal Financial',     e:'NSE', seg:'EQ', k:'NSE_EQ|INE338A01024'},
  {s:'360ONE',    n:'360 ONE WAM',                 e:'NSE', seg:'EQ', k:'NSE_EQ|INE466L01038'},
  {s:'SIEMENS',   n:'Siemens',                     e:'NSE', seg:'EQ', k:'NSE_EQ|INE003A01024'},
  {s:'ABB',       n:'ABB India',                   e:'NSE', seg:'EQ', k:'NSE_EQ|INE117A01022'},
  {s:'CUMMINSIND',n:'Cummins India',               e:'NSE', seg:'EQ', k:'NSE_EQ|INE298A01020'},
  {s:'THERMAX',   n:'Thermax',                     e:'NSE', seg:'EQ', k:'NSE_EQ|INE152C01011'},
  {s:'VOLTAS',    n:'Voltas',                      e:'NSE', seg:'EQ', k:'NSE_EQ|INE226A01021'},
  {s:'WHIRLPOOL', n:'Whirlpool of India',          e:'NSE', seg:'EQ', k:'NSE_EQ|INE716A01013'},
  {s:'CROMPTON',  n:'Crompton Greaves Consumer',   e:'NSE', seg:'EQ', k:'NSE_EQ|INE388A01029'},
  {s:'AMBER',     n:'Amber Enterprises',           e:'NSE', seg:'EQ', k:'NSE_EQ|INE246R01010'},
  {s:'KAYNES',    n:'Kaynes Technology',           e:'NSE', seg:'EQ', k:'NSE_EQ|INE918Z01012'},
  {s:'IDEAFORGE', n:'ideaForge Technology',        e:'NSE', seg:'EQ', k:'NSE_EQ|INE427K01011'},
  {s:'DOMS',      n:'DOMS Industries',             e:'NSE', seg:'EQ', k:'NSE_EQ|INE0JL401010'},
]

// ─── Smart search function ────────────────────────────────────────────────────
function smartSearch(query) {
  if (!query || query.trim().length < 1) return []
  const q = query.trim().toUpperCase()

  return SYMBOLS
    .map(sym => {
      const sUpper = sym.s.toUpperCase()
      const nUpper = sym.n.toUpperCase()
      let score = 0

      if (sUpper === q)                    score = 200  // exact symbol match
      else if (sUpper.startsWith(q))       score = 150  // symbol starts with
      else if (nUpper.startsWith(q))       score = 120  // name starts with
      else if (sUpper.includes(q))         score = 80   // symbol contains
      else if (nUpper.includes(q))         score = 50   // name contains
      else return null                                   // no match

      if (sym.seg === 'INDEX') score += 10  // boost indices
      if (sym.seg === 'EQ')    score += 5

      return { ...sym, score }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}

const SEG_COLOR = {
  'INDEX': { bg:'#5865f220', color:'#7c8af7', label:'INDEX' },
  'EQ':    { bg:'#22c55e15', color:'#22c55e', label:'EQ' },
}

export default function SearchBar({ onAnalyze, loading }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(-1)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  // Instant search on every keystroke
  useEffect(() => {
    const r = smartSearch(query)
    setResults(r)
    setHovered(-1)
  }, [query])

  function select(sym) {
    setQuery(sym.s)
    setResults([])
    setFocused(false)
    onAnalyze({ symbol: sym.s, instrumentKey: sym.k }, '5')
  }

  function onKeyDown(e) {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHovered(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHovered(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (hovered >= 0) select(results[hovered])
      else if (results[0]) select(results[0])
      else onAnalyze(query.trim().toUpperCase(), '5')
    } else if (e.key === 'Escape') {
      setResults([]); setFocused(false); inputRef.current?.blur()
    }
  }

  const showDropdown = focused && results.length > 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

      {/* Search box */}
      <div style={{ position:'relative' }}>
        {/* Icon */}
        <svg style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
          color: focused ? 'var(--accent2)' : 'var(--text3)', transition:'color .15s', pointerEvents:'none' }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>

        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value.toUpperCase()); setFocused(true) }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          onKeyDown={onKeyDown}
          placeholder="Search stocks, indices… e.g. REL, HDFC, NIFTY"
          className="input"
          autoComplete="off"
          style={{
            height: 46, paddingLeft: 42, paddingRight: 100,
            fontSize: 14, fontFamily:"'DM Sans',sans-serif",
            borderColor: focused ? 'var(--accent)' : 'var(--border)',
            boxShadow: focused ? '0 0 0 3px #5865f220' : 'none',
          }}
        />

        {/* Inline analyze button */}
        <button
          onClick={() => {
            if (results[0]) select(results[0])
            else onAnalyze(query.trim().toUpperCase() || 'NIFTY', '5')
          }}
          disabled={loading}
          className="btn btn-primary"
          style={{
            position:'absolute', right:4, top:'50%', transform:'translateY(-50%)',
            height:38, padding:'0 14px', fontSize:13,
            fontFamily:"'Syne',sans-serif", fontWeight:700,
          }}>
          {loading
            ? <span className="anim-spin" style={{ display:'inline-block', width:14, height:14, border:'2px solid #ffffff40', borderTopColor:'#fff', borderRadius:'50%' }}/>
            : '▶'}
        </button>

        {/* ── Dropdown ── */}
        {showDropdown && (
          <div ref={listRef} style={{
            position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:1000,
            background:'var(--surface)', border:'1px solid var(--bd2)',
            borderRadius:10, boxShadow:'0 12px 40px rgba(0,0,0,.6)',
            overflow:'hidden',
          }}>
            {/* Header */}
            <div style={{ padding:'6px 14px', background:'var(--bg2)', borderBottom:'1px solid var(--border)',
              fontSize:10, color:'var(--text3)', fontWeight:600, letterSpacing:1,
              display:'flex', justifyContent:'space-between' }}>
              <span>RESULTS ({results.length})</span>
              <span>↑↓ navigate · Enter select · Esc close</span>
            </div>

            {results.map((sym, i) => {
              const seg = SEG_COLOR[sym.seg] || SEG_COLOR.EQ
              const isHovered = hovered === i
              return (
                <div
                  key={sym.k}
                  onMouseDown={() => select(sym)}
                  onMouseEnter={() => setHovered(i)}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 14px', cursor:'pointer',
                    borderBottom:'1px solid var(--border)',
                    background: isHovered ? 'var(--surface2)' : 'transparent',
                    transition:'background .1s',
                  }}>
                  {/* Symbol */}
                  <div style={{ minWidth:90 }}>
                    <div style={{
                      fontFamily:"'DM Mono',monospace", fontWeight:600,
                      fontSize:14, color: isHovered ? 'var(--accent2)' : 'var(--text)',
                      letterSpacing:.5,
                    }}>{sym.s}</div>
                  </div>
                  {/* Name */}
                  <div style={{ flex:1, fontSize:12, color:'var(--text2)', lineHeight:1.3 }}>
                    {sym.n}
                  </div>
                  {/* Badges */}
                  <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4,
                      background: seg.bg, color: seg.color,
                      fontFamily:"'DM Mono',monospace", fontWeight:600 }}>
                      {seg.label}
                    </span>
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4,
                      background:'#1e2d42', color:'var(--text3)',
                      fontFamily:"'DM Mono',monospace" }}>
                      {sym.e}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick watchlist chips */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {['NIFTY','BANKNIFTY','RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','SBIN','WIPRO','ADANIENT'].map(chip => (
          <button key={chip}
            onClick={() => { setQuery(chip); onAnalyze({ symbol:chip, instrumentKey: SYMBOLS.find(s=>s.s===chip)?.k||'' }, '5') }}
            style={{
              padding:'4px 11px', borderRadius:20, cursor:'pointer',
              border:`1px solid ${query===chip ? 'var(--accent)' : 'var(--border)'}`,
              background: query===chip ? '#5865f215' : 'var(--bg2)',
              color: query===chip ? 'var(--accent2)' : 'var(--text3)',
              fontSize:12, fontWeight:500, transition:'all .15s',
              fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap',
            }}
            onMouseEnter={e => { if(query!==chip){ e.currentTarget.style.borderColor='var(--bd2)'; e.currentTarget.style.color='var(--text2)' }}}
            onMouseLeave={e => { if(query!==chip){ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text3)' }}}>
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}
