import React, { useState } from 'react'

const EVENTS = [
  // June 2026
  { date:'2026-06-06', time:'10:00', event:'RBI MPC Policy Decision', impact:'HIGH', category:'Monetary Policy', prev:'6.25%', exp:'6.00%', actual:null },
  { date:'2026-06-09', time:'05:30', event:'US Non-Farm Payrolls', impact:'HIGH', category:'Global', prev:'227K', exp:'185K', actual:null },
  { date:'2026-06-10', time:'11:30', event:'India CPI Inflation (May)', impact:'HIGH', category:'Inflation', prev:'4.83%', exp:'4.72%', actual:null },
  { date:'2026-06-11', time:'12:00', event:'India IIP (Apr)', impact:'MED', category:'Growth', prev:'4.9%', exp:'5.1%', actual:null },
  { date:'2026-06-12', time:'11:00', event:'India WPI (May)', impact:'MED', category:'Inflation', prev:'1.26%', exp:'1.10%', actual:null },
  { date:'2026-06-14', time:'17:30', event:'F&O Expiry — Weekly', impact:'HIGH', category:'F&O', prev:'—', exp:'—', actual:null },
  { date:'2026-06-16', time:'09:00', event:'Advance Tax Payment Due', impact:'MED', category:'Tax', prev:'—', exp:'—', actual:null },
  { date:'2026-06-18', time:'20:00', event:'US Fed FOMC Decision', impact:'HIGH', category:'Global', prev:'5.25%', exp:'5.00%', actual:null },
  { date:'2026-06-20', time:'11:30', event:'India Trade Balance (May)', impact:'MED', category:'Trade', prev:'-$14.8B', exp:'-$13.5B', actual:null },
  { date:'2026-06-26', time:'17:30', event:'F&O Monthly Expiry (Jun)', impact:'HIGH', category:'F&O', prev:'—', exp:'—', actual:null },
  { date:'2026-06-28', time:'11:30', event:'India GDP (Q4 FY26)', impact:'HIGH', category:'Growth', prev:'6.2%', exp:'6.8%', actual:null },
  { date:'2026-07-01', time:'17:30', event:'F&O Expiry — Weekly', impact:'HIGH', category:'F&O', prev:'—', exp:'—', actual:null },
  { date:'2026-07-04', time:'All day', event:'US Independence Day — Markets Closed', impact:'LOW', category:'Holiday', prev:'—', exp:'—', actual:null },
  { date:'2026-07-07', time:'12:00', event:'RBI Monetary Policy Meeting Begins', impact:'HIGH', category:'Monetary Policy', prev:'—', exp:'—', actual:null },
  { date:'2026-07-15', time:'21:30', event:'US CPI (Jun)', impact:'HIGH', category:'Global', prev:'3.4%', exp:'3.2%', actual:null },
  { date:'2026-07-25', time:'17:30', event:'F&O Monthly Expiry (Jul)', impact:'HIGH', category:'F&O', prev:'—', exp:'—', actual:null },
]

const IMPACT_COLOR = { HIGH:'var(--red)', MED:'var(--amber)', LOW:'var(--text3)' }
const CAT_EMOJI = { 'Monetary Policy':'🏦', 'Global':'🌍', 'Inflation':'📈', 'Growth':'🚀', 'Trade':'⚖️', 'F&O':'📊', 'Tax':'💰', 'Holiday':'🎉' }

function EconomicCalendar() {
  const [filter, setFilter] = useState('ALL')
  const today = new Date().toISOString().slice(0,10)

  const filtered = EVENTS.filter(e => filter === 'ALL' || e.impact === filter || e.category === filter)
    .sort((a,b) => a.date.localeCompare(b.date))

  const upcoming = filtered.filter(e => e.date >= today)
  const past     = filtered.filter(e => e.date < today)

  function EventRow({ e, isPast }) {
    const d = new Date(e.date)
    const dayName = d.toLocaleDateString('en-IN',{weekday:'short'})
    const dateStr = d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})
    const isToday = e.date === today

    return (
      <div style={{
        display:'grid', gridTemplateColumns:'80px 24px 1fr 60px 60px 60px',
        alignItems:'center', gap:10,
        padding:'10px 16px', borderBottom:'1px solid var(--border)',
        background: isToday ? '#5865f210' : isPast ? 'transparent' : 'transparent',
        opacity: isPast ? 0.6 : 1,
      }}>
        {/* Date */}
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:600,color:isToday?'var(--accent2)':'var(--text)'}}>{dateStr}</div>
          <div style={{fontSize:10,color:'var(--text3)'}}>{dayName} · {e.time}</div>
        </div>
        {/* Impact dot */}
        <div style={{width:8,height:8,borderRadius:'50%',background:IMPACT_COLOR[e.impact],boxShadow:e.impact==='HIGH'?`0 0 6px ${IMPACT_COLOR[e.impact]}`:'none'}}/>
        {/* Event */}
        <div>
          <div style={{fontSize:13,color:'var(--text)',fontWeight:500}}>{CAT_EMOJI[e.category]||'📌'} {e.event}</div>
          <div style={{fontSize:10,color:'var(--text3)'}}>{e.category}</div>
        </div>
        {/* Prev/Exp/Actual */}
        <div style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text3)'}}>{e.prev}</div>
        <div style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--amber)'}}>{e.exp}</div>
        <div style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600,color:e.actual?'var(--green)':'var(--text3)'}}>{e.actual||'—'}</div>
      </div>
    )
  }

  return (
    <div className="card anim-fade">
      <div className="card-header">
        <span style={{fontSize:16}}>📅</span>
        <span className="card-title">Economic Calendar</span>
        <div style={{marginLeft:'auto',display:'flex',gap:4}}>
          {['ALL','HIGH','F&O','Monetary Policy'].map(f2=>(
            <button key={f2} onClick={()=>setFilter(f2)} style={{
              padding:'3px 9px',borderRadius:5,border:'none',cursor:'pointer',fontSize:11,
              background:filter===f2?'var(--accent)':'var(--bg2)',
              color:filter===f2?'#fff':'var(--text3)',transition:'all .15s',
            }}>{f2}</button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div style={{display:'grid',gridTemplateColumns:'80px 24px 1fr 60px 60px 60px',gap:10,padding:'6px 16px',background:'var(--bg2)',borderBottom:'1px solid var(--border)'}}>
        {['Date','','Event','Prev','Exp','Actual'].map(h=>(
          <div key={h} style={{fontSize:10,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.8,textAlign:['Prev','Exp','Actual'].includes(h)?'right':'left'}}>{h}</div>
        ))}
      </div>

      <div style={{maxHeight:450,overflowY:'auto'}}>
        {upcoming.length > 0 && (
          <>
            <div style={{padding:'8px 16px',background:'var(--bg)',fontSize:11,fontWeight:700,color:'var(--accent2)',letterSpacing:1,textTransform:'uppercase'}}>
              UPCOMING ({upcoming.length})
            </div>
            {upcoming.map((e,i) => <EventRow key={i} e={e}/>)}
          </>
        )}
        {past.length > 0 && (
          <>
            <div style={{padding:'8px 16px',background:'var(--bg)',fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:1,textTransform:'uppercase'}}>
              PAST EVENTS
            </div>
            {past.slice(0,5).map((e,i) => <EventRow key={i} e={e} isPast/>)}
          </>
        )}
      </div>

      {/* Legend */}
      <div style={{padding:'8px 16px',borderTop:'1px solid var(--border)',display:'flex',gap:16,flexWrap:'wrap'}}>
        {[['HIGH','var(--red)','High Impact'],['MED','var(--amber)','Medium'],['LOW','var(--text3)','Low']].map(([k,c,l])=>(
          <div key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:c}}/>
            {l}
          </div>
        ))}
        <span style={{fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>Prev = Previous · Exp = Forecast</span>
      </div>
    </div>
  )
}

export default React.memo(EconomicCalendar)
