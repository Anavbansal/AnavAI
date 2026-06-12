import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config'

const f = (n,d=2) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})

// Static market movers (would be live with valid Upstox token)
const MOVERS = {
  gainers: [
    {sym:'ADANIENT', price:2387, chg:3.42, vol:'18.2M'},{sym:'TATAMOTORS',price:1023,chg:2.87,vol:'24.5M'},
    {sym:'HCLTECH',  price:1672, chg:2.31, vol:'9.8M'}, {sym:'SUNPHARMA', price:1834,chg:1.98,vol:'7.2M'},
    {sym:'BAJFINANCE',price:7312,chg:1.76, vol:'5.1M'}, {sym:'LTIM',      price:5820,chg:1.54,vol:'3.4M'},
    {sym:'WIPRO',    price:481,  chg:1.43, vol:'12.1M'},{sym:'TITAN',     price:3412,chg:1.38,vol:'4.9M'},
  ],
  losers: [
    {sym:'ITC',      price:421,  chg:-2.18,vol:'31.4M'},{sym:'ONGC',      price:267, chg:-1.89,vol:'22.1M'},
    {sym:'COALINDIA',price:442,  chg:-1.67,vol:'14.8M'},{sym:'BHARTIARTL',price:1687,chg:-1.42,vol:'8.3M'},
    {sym:'POWERGRID',price:298,  chg:-1.24,vol:'11.2M'},{sym:'NTPC',      price:356, chg:-1.11,vol:'16.7M'},
    {sym:'SBIN',     price:812,  chg:-0.98,vol:'19.3M'},{sym:'AXISBANK',  price:1139,chg:-0.87,vol:'10.1M'},
  ],
  volumeSpikes: [
    {sym:'NIFTY',    price:24812, chg:0.38, vol:'—',      reason:'Index rebalance'},
    {sym:'RELIANCE', price:2891,  chg:1.23, vol:'28.4M',  reason:'Block deal ₹2890'},
    {sym:'HDFCBANK', price:1618,  chg:0.87, vol:'41.2M',  reason:'FII buying'},
    {sym:'TCS',      price:3756,  chg:-0.34,vol:'15.8M',  reason:'Quarterly results'},
    {sym:'INFY',     price:1551,  chg:0.56, vol:'22.7M',  reason:'Order win news'},
    {sym:'ICICIBANK',price:1291,  chg:1.12, vol:'37.9M',  reason:'RBI policy positive'},
  ],
}

const INDICES = [
  {name:'NIFTY 50',  val:24812, chg:0.38},{name:'BANK NIFTY',val:52341,chg:0.58},
  {name:'SENSEX',    val:81621, chg:0.35},{name:'FIN NIFTY', val:23512,chg:-0.22},
  {name:'NIFTY IT',  val:38420, chg:1.42},{name:'NIFTY PHARMA',val:21840,chg:0.67},
  {name:'NIFTY AUTO',val:22140, chg:2.14},{name:'NIFTY FMCG', val:56230,chg:-0.31},
]

function MarketScanner({ onSelectSymbol }) {
  const [tab, setTab] = useState('gainers')
  const [filter, setFilter] = useState('')

  const data = MOVERS[tab] || []
  const filtered = filter ? data.filter(d => d.sym.includes(filter.toUpperCase())) : data

  return (
    <div className="card anim-fade">
      <div className="card-header">
        <span style={{fontSize:16}}>📡</span>
        <span className="card-title">Market Scanner</span>
        <span style={{marginLeft:'auto',fontSize:11,color:'var(--green)',display:'flex',alignItems:'center',gap:4}}>
          <span style={{width:5,height:5,borderRadius:'50%',background:'var(--green)',display:'inline-block',animation:'pulse 2s infinite'}}/>
          NSE Live
        </span>
      </div>

      {/* Index strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,background:'var(--border)',borderBottom:'1px solid var(--border)'}}>
        {INDICES.map(idx=>(
          <div key={idx.name} style={{background:'var(--bg2)',padding:'8px 12px'}}>
            <div style={{fontSize:10,color:'var(--text3)',fontWeight:600,marginBottom:2}}>{idx.name}</div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:13,color:'var(--text)'}}>
                {idx.val.toLocaleString('en-IN')}
              </span>
              <span style={{fontSize:11,fontWeight:600,color:idx.chg>=0?'var(--green)':'var(--red)'}}>
                {idx.chg>=0?'▲':'▼'}{Math.abs(idx.chg)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Scanner tabs */}
      <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',background:'var(--bg2)'}}>
        {[
          {id:'gainers',label:'🚀 Top Gainers'},
          {id:'losers', label:'📉 Top Losers'},
          {id:'volumeSpikes',label:'🔥 Volume Spikes'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1, padding:'9px', border:'none', cursor:'pointer', fontSize:12,
            fontWeight: tab===t.id ? 600 : 400,
            background: tab===t.id ? 'var(--surface)' : 'transparent',
            color: tab===t.id ? 'var(--text)' : 'var(--text3)',
            borderBottom: tab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
            transition:'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{overflowX:'auto'}}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th style={{textAlign:'right'}}>Price</th>
              <th style={{textAlign:'right'}}>Change</th>
              <th style={{textAlign:'right'}}>Volume</th>
              {tab==='volumeSpikes' && <th>Reason</th>}
              <th style={{textAlign:'center'}}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row=>{
              const bull = row.chg >= 0
              return (
                <tr key={row.sym}>
                  <td>
                    <span style={{color:'var(--accent2)',fontWeight:700,cursor:'pointer'}}
                      onClick={()=>onSelectSymbol?.(row.sym)}>{row.sym}</span>
                  </td>
                  <td style={{textAlign:'right',color:'var(--text)',fontWeight:500}}>₹{f(row.price)}</td>
                  <td style={{textAlign:'right'}}>
                    <span style={{color:bull?'var(--green)':'var(--red)',fontWeight:700}}>
                      {bull?'▲':'▼'} {Math.abs(row.chg).toFixed(2)}%
                    </span>
                  </td>
                  <td style={{textAlign:'right',color:'var(--text3)'}}>{row.vol}</td>
                  {tab==='volumeSpikes' && <td style={{color:'var(--text2)',fontSize:11}}>{row.reason}</td>}
                  <td style={{textAlign:'center'}}>
                    <button onClick={()=>onSelectSymbol?.(row.sym)}
                      className="btn btn-ghost" style={{fontSize:11,padding:'3px 10px'}}>
                      Analyze
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{padding:'8px 16px',borderTop:'1px solid var(--border)',fontSize:11,color:'var(--text3)'}}>
        💡 Click any symbol to analyze it · Live data requires valid Upstox token
      </div>
    </div>
  )
}

export default React.memo(MarketScanner)
