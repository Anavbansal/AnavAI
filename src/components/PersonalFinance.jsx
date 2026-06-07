import React, { useState } from 'react'

const f = (n, d=0) => Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:d, maximumFractionDigits:d})
const fc = (n) => `₹${f(n)}`

// ── YOUR ACTUAL DATA ─────────────────────────────────────────────────────────
const DATA = {
  stocks: [
    {broker:'Angel One', symbol:'NTPC',   name:'NTPC',              isin:'INE733E01010', cap:'LargeCap',  sector:'Power',     qty:1,  avg:423.62,  invested:423.62},
    {broker:'Angel One', symbol:'CESC',   name:'CESC',              isin:'INE486A01021', cap:'LargeCap',  sector:'Power',     qty:38, avg:132.10,  invested:5019.80},
    {broker:'Angel One', symbol:'IRFC',   name:'IRFC',              isin:'INE053F01010', cap:'LargeCap',  sector:'Finance',   qty:20, avg:151.51,  invested:3030.20},
    {broker:'Angel One', symbol:'RVNL',   name:'Rail Vikas Nigam',  isin:'INE415G01027', cap:'LargeCap',  sector:'Engg',      qty:30, avg:211.51,  invested:6345.30},
    {broker:'Angel One', symbol:'TATAPOWER',name:'Tata Power',      isin:'INE245A01021', cap:'LargeCap',  sector:'Power',     qty:15, avg:363.82,  invested:5457.30},
    {broker:'Angel One', symbol:'ZOMATO', name:'Zomato',            isin:'INE758T01015', cap:'LargeCap',  sector:'IT',        qty:20, avg:193.54,  invested:3870.80},
    {broker:'Angel One', symbol:'TATASTEEL',name:'Tata Steel',      isin:'INE081A01020', cap:'LargeCap',  sector:'Steel',     qty:101,avg:118.51,  invested:11969.51},
    {broker:'Angel One', symbol:'VPRPL',  name:'VPRPL',             isin:'INE0AE001013', cap:'SmallCap',  sector:'Realty',    qty:31, avg:200.68,  invested:6221.08},
    {broker:'Angel One', symbol:'NATIONALUM',name:'Natl. Aluminium',isin:'INE139A01034', cap:'LargeCap',  sector:'Aluminium', qty:82, avg:110.77,  invested:9083.14},
    {broker:'Angel One', symbol:'CANBK',  name:'Canara Bank',       isin:'INE476A01022', cap:'LargeCap',  sector:'Banking',   qty:1,  avg:109.22,  invested:109.22},
    {broker:'Angel One', symbol:'SUZLON', name:'Suzlon Energy',     isin:'INE040H01021', cap:'LargeCap',  sector:'Renewable', qty:47, avg:59.71,   invested:2806.37},
    {broker:'Angel One', symbol:'HAL',    name:'HAL',               isin:'INE066F01020', cap:'LargeCap',  sector:'Defence',   qty:1,  avg:3996.00, invested:3996.00},
    {broker:'Angel One', symbol:'HSCL',   name:'Himadri Speciality',isin:'INE019C01026', cap:'LargeCap',  sector:'Chemicals', qty:17, avg:410.76,  invested:6982.92},
    {broker:'Angel One', symbol:'XCHANGING',name:'Xchanging Sol.',  isin:'INE692G01013', cap:'SmallCap',  sector:'BPO/IT',    qty:40, avg:122.69,  invested:4907.60},
  ],

  mutualFunds: [
    {cat:'Equity',       name:'Mahindra Flexi Cap Yoj',              folio:'1000543712',    sipDate:'10th', sip:2500,  consultant:'Raj Kumar Chotiya', bank:'PNB Debit Card'},
    {cat:'Equity',       name:'Invesco India Financial Services',     folio:'31014963355',   sipDate:'10th', sip:2500,  consultant:'Raj Kumar Chotiya', bank:'PNB Debit Card'},
    {cat:'Equity',       name:'Bandhan Midcap Fund',                  folio:'4263637/91',    sipDate:'10th', sip:1500,  consultant:'Raj Kumar Chotiya', bank:'PNB Debit Card'},
    {cat:'Equity',       name:'Bajaj Finserv Large & Mid Cap',        folio:'4263637/91',    sipDate:'10th', sip:3000,  consultant:'Raj Kumar Chotiya', bank:'PNB Debit Card'},
    {cat:'Equity',       name:'Mirae Asset Multicap Fund',            folio:'77780532686',   sipDate:'10th', sip:3000,  consultant:'Raj Kumar Chotiya', bank:'PNB Debit Card'},
    {cat:'Equity',       name:'Invesco India Small Cap Fund',         folio:'31042334532',   sipDate:'10th', sip:2000,  consultant:'Santosh Goyal',     bank:'PNB Debit Card'},
    {cat:'Equity',       name:'Nippon India Small Cap Fund',          folio:'477488979917',  sipDate:'10th', sip:2000,  consultant:'GROWW',             bank:'PNB UPI'},
    {cat:'Equity',       name:'Invesco India Small Cap (Hold)',        folio:'31043237462',   sipDate:'Hold', sip:2000,  consultant:'Santosh Goyal',     bank:'PNB Debit Card'},
    {cat:'Debt',         name:'ICICI Prudential Short Term Fund',     folio:'43600048',      sipDate:'10th', sip:4000,  consultant:'GROWW',             bank:'PNB UPI'},
    {cat:'Gold & Silver',name:'HDFC Silver ETF FoF',                  folio:'41528003',      sipDate:'Hold', sip:1000,  consultant:'GROWW',             bank:'PNB UPI'},
    {cat:'Gold & Silver',name:'SBI Gold Direct',                      folio:'49312865',      sipDate:'Hold', sip:1500,  consultant:'GROWW',             bank:'PNB UPI'},
  ],

  insurance: [
    {holder:'Anav Bansal',  type:'Term Insurance',    provider:'HDFC Life Click 2 Protect Super', policy:'26996601',          premium:12068,  due:'25th Jan (Annual)',        bank:'PNB'},
    {holder:'Mummy & Papa', type:'Medical Insurance', provider:'HDFC ERGO Optima Super Secure',  policy:'2856207123377699', premium:116228, due:'22nd Jan (2025-2028)',     bank:'PNB'},
    {holder:'Anav',         type:'Medical Insurance', provider:'HDFC ERGO Optima Super Secure',  policy:'2856207409031099', premium:40112,  due:'18th May (2025-2028)',     bank:'PNB'},
  ],

  payments: [
    {due:'Jan 07 & Jul 07 (Half-Yearly)', policy:'199616499',         beneficiary:'Anav',        provider:'LIC',                  premium:2970,   paid2526:true,  paid2627:false},
    {due:'Jan 19 (Annual)',               policy:'478228467',         beneficiary:'Anav',        provider:'LIC',                  premium:11370,  paid2526:true,  paid2627:false},
    {due:'Jan 25 (Annual)',               policy:'26996601',          beneficiary:'Anav',        provider:'HDFC Life',            premium:12068,  paid2526:true,  paid2627:true},
    {due:'Jan 22 (Annual)',               policy:'2856207123377699',  beneficiary:'Mummy & Papa',provider:'HDFC ERGO',            premium:116102, paid2526:true,  paid2627:true},
    {due:'Apr 01 (Annual)',               policy:'110157737148',      beneficiary:'Anav',        provider:'NPS Scheme',           premium:1500,   paid2526:true,  paid2627:false},
    {due:'May 18 (Annual)',               policy:'2856207409031099',  beneficiary:'Anav',        provider:'HDFC ERGO',            premium:40823,  paid2526:true,  paid2627:true},
    {due:'Apr 01 (Annual)',               policy:'-',                 beneficiary:'Anav',        provider:'EPF (Post Office)',    premium:500,    paid2526:true,  paid2627:false},
  ],

  emergency: [
    {cat:'Instant Cash',    institution:'SBI Bank Account',              current:35000,  target:45000,  liquidity:'Instant',         account:'40990035979'},
    {cat:'Short-Term',      institution:'Axis Liquid Fund (Groww)',       current:50000,  target:145000, liquidity:'30 mins - 1 day', account:'910222425193'},
    {cat:'Short-Term',      institution:'ICICI Prudential Short Term',   current:10000,  target:10000,  liquidity:'1 Working Day',   account:'43600048'},
  ],
}

// ── Summary calculations
const totalStocksInvested = DATA.stocks.reduce((s,x)=>s+x.invested, 0)
const totalSIP = DATA.mutualFunds.reduce((s,x)=>s+x.sip, 0)
const totalInsurance = DATA.insurance.reduce((s,x)=>s+x.premium, 0)
const totalEmergency = DATA.emergency.reduce((s,x)=>s+x.current, 0)
const totalEmergencyTarget = DATA.emergency.reduce((s,x)=>s+x.target, 0)
const totalPayments = DATA.payments.reduce((s,x)=>s+x.premium, 0)

const CAT_COLOR = {
  'Equity':       {bg:'#5865f215',color:'#7c8af7',border:'#5865f233'},
  'Debt':         {bg:'#f59e0b15',color:'#f59e0b',border:'#f59e0b33'},
  'Gold & Silver':{bg:'#fbbf2415',color:'#fbbf24',border:'#fbbf2433'},
}

const SECTOR_COLOR = {
  'Power':'#3b82f6','Finance':'#8b5cf6','Engg':'#f97316','IT':'#6366f1',
  'Steel':'#94a3b8','Realty':'#ec4899','Aluminium':'#14b8a6','Banking':'#22c55e',
  'Renewable':'#84cc16','Defence':'#ef4444','Chemicals':'#f59e0b','BPO/IT':'#a78bfa',
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
      <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#5865f2,#22c55e)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{icon}</div>
      <div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:'var(--text)'}}>{title}</div>
        {subtitle && <div style={{fontSize:11,color:'var(--text3)'}}>{subtitle}</div>}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color='var(--accent2)', icon }) {
  return (
    <div style={{padding:'14px 16px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
        {icon && <span style={{fontSize:16}}>{icon}</span>}
        <span style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:.8}}>{label}</span>
      </div>
      <div style={{fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:20,color}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>{sub}</div>}
    </div>
  )
}

// ── Tab components ──────────────────────────────────────────────────────────
function OverviewTab() {
  const totalInvested = totalStocksInvested + totalSIP * 12 // approx
  const totalAnnualOutgo = totalPayments

  const breakdown = [
    { label: 'Stocks (Invested)', value: totalStocksInvested, color: '#5865f2', icon: '📈' },
    { label: 'Monthly SIP', value: totalSIP, color: '#22c55e', icon: '🔄' },
    { label: 'Insurance (Annual)', value: totalInsurance, color: '#ef4444', icon: '🛡️' },
    { label: 'Emergency Fund', value: totalEmergency, color: '#f59e0b', icon: '🏦' },
  ]

  const maxVal = Math.max(...breakdown.map(b=>b.value))

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
        <StatCard icon="📈" label="Stocks Invested" value={fc(totalStocksInvested)} sub={`${DATA.stocks.length} holdings`} color='#6366f1'/>
        <StatCard icon="🔄" label="Monthly SIP" value={fc(totalSIP)} sub={`${DATA.mutualFunds.length} funds`} color='var(--green)'/>
        <StatCard icon="🛡️" label="Annual Insurance" value={fc(totalInsurance)} sub={`${DATA.insurance.length} policies`} color='var(--red)'/>
        <StatCard icon="🏦" label="Emergency Fund" value={fc(totalEmergency)} sub={`Target: ${fc(totalEmergencyTarget)}`} color='var(--amber)'/>
      </div>

      {/* Bar chart */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">💰 Investment Breakdown</span>
          <span style={{marginLeft:'auto',fontSize:11,color:'var(--text3)'}}>Total outgo ₹{f(totalAnnualOutgo)}/yr (insurance)</span>
        </div>
        <div style={{padding:16,display:'flex',flexDirection:'column',gap:10}}>
          {breakdown.map(b=>(
            <div key={b.label}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:12,color:'var(--text2)',display:'flex',alignItems:'center',gap:6}}>
                  <span>{b.icon}</span>{b.label}
                </span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color:b.color}}>{fc(b.value)}</span>
              </div>
              <div className="progress">
                <div className="progress-fill" style={{width:`${(b.value/maxVal)*100}%`,background:b.color}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total annual outgo */}
      <div className="card" style={{padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:12,color:'var(--text3)',fontWeight:600,marginBottom:4}}>TOTAL ANNUAL PAYMENT OUTGO</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:28,fontWeight:700,color:'var(--red)'}}>{fc(totalPayments)}</div>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>Insurance + NPS + EPF</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:12,color:'var(--text3)',fontWeight:600,marginBottom:4}}>MONTHLY EQUIVALENT</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:20,fontWeight:600,color:'var(--amber)'}}>{fc(Math.round(totalPayments/12))}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StocksTab() {
  const [sort, setSort] = useState('invested')
  const sorted = [...DATA.stocks].sort((a,b) => {
    if (sort==='invested') return b.invested - a.invested
    if (sort==='qty') return b.qty - a.qty
    if (sort==='avg') return b.avg - a.avg
    return a.name.localeCompare(b.name)
  })

  // Sector breakdown
  const sectors = {}
  DATA.stocks.forEach(s => {
    sectors[s.sector] = (sectors[s.sector]||0) + s.invested
  })

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* Sector mini chart */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📊 Sector Allocation</span>
          <span style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--text2)'}}>{fc(totalStocksInvested)} total</span>
        </div>
        <div style={{padding:'12px 16px',display:'flex',flexWrap:'wrap',gap:8}}>
          {Object.entries(sectors).sort((a,b)=>b[1]-a[1]).map(([sec,amt])=>(
            <div key={sec} style={{
              display:'flex',alignItems:'center',gap:6,
              padding:'5px 12px',borderRadius:20,
              background:`${SECTOR_COLOR[sec]||'#5865f2'}15`,
              border:`1px solid ${SECTOR_COLOR[sec]||'#5865f2'}33`,
            }}>
              <span style={{width:8,height:8,borderRadius:'50%',background:SECTOR_COLOR[sec]||'#5865f2',display:'inline-block'}}/>
              <span style={{fontSize:12,color:'var(--text2)',fontWeight:500}}>{sec}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:SECTOR_COLOR[sec]||'#5865f2',fontWeight:600}}>{fc(amt)}</span>
              <span style={{fontSize:10,color:'var(--text3)'}}>({((amt/totalStocksInvested)*100).toFixed(0)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Holdings table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 Holdings ({DATA.stocks.length})</span>
          <div style={{marginLeft:'auto',display:'flex',gap:4}}>
            {[['invested','By Value'],['name','A-Z'],['qty','By Qty']].map(([k,l])=>(
              <button key={k} onClick={()=>setSort(k)} style={{
                padding:'3px 9px',borderRadius:5,border:'none',cursor:'pointer',fontSize:11,
                background:sort===k?'var(--accent)':'var(--bg2)',
                color:sort===k?'#fff':'var(--text3)',
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Stock</th>
                <th>Sector</th>
                <th>Cap</th>
                <th style={{textAlign:'right'}}>Qty</th>
                <th style={{textAlign:'right'}}>Avg Price</th>
                <th style={{textAlign:'right'}}>Invested</th>
                <th style={{textAlign:'right'}}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s,i)=>(
                <tr key={i}>
                  <td>
                    <div style={{fontFamily:"'DM Mono',monospace",fontWeight:600,color:'var(--accent2)'}}>{s.symbol}</div>
                    <div style={{fontSize:10,color:'var(--text3)'}}>{s.name}</div>
                  </td>
                  <td>
                    <span style={{
                      fontSize:10,padding:'2px 7px',borderRadius:4,
                      background:`${SECTOR_COLOR[s.sector]||'#5865f2'}15`,
                      color:SECTOR_COLOR[s.sector]||'#5865f2',
                      fontFamily:"'DM Mono',monospace",
                    }}>{s.sector}</span>
                  </td>
                  <td>
                    <span style={{fontSize:10,color:s.cap==='LargeCap'?'var(--green)':'var(--amber)'}}>{s.cap}</span>
                  </td>
                  <td style={{textAlign:'right',fontFamily:"'DM Mono',monospace"}}>{s.qty}</td>
                  <td style={{textAlign:'right',fontFamily:"'DM Mono',monospace"}}>{fc(s.avg)}</td>
                  <td style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:600,color:'var(--text)'}}>{fc(s.invested)}</td>
                  <td style={{textAlign:'right'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
                      <div style={{width:40,height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${(s.invested/totalStocksInvested)*100}%`,background:'var(--accent)',borderRadius:2}}/>
                      </div>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'var(--text3)',minWidth:30}}>
                        {((s.invested/totalStocksInvested)*100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background:'var(--bg2)'}}>
                <td colSpan={5} style={{fontWeight:700,color:'var(--text)',fontSize:13}}>TOTAL</td>
                <td style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--accent2)',fontSize:14}}>{fc(totalStocksInvested)}</td>
                <td style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text3)'}}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function MFTab() {
  const equitySIP  = DATA.mutualFunds.filter(f=>f.cat==='Equity').reduce((s,f)=>s+f.sip,0)
  const debtSIP    = DATA.mutualFunds.filter(f=>f.cat==='Debt').reduce((s,f)=>s+f.sip,0)
  const goldSIP    = DATA.mutualFunds.filter(f=>f.cat==='Gold & Silver').reduce((s,f)=>s+f.sip,0)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* SIP summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        <StatCard icon="📈" label="Equity SIP" value={fc(equitySIP)} sub="/month" color='#6366f1'/>
        <StatCard icon="🏛️" label="Debt SIP" value={fc(debtSIP)} sub="/month" color='var(--amber)'/>
        <StatCard icon="🥇" label="Gold/Silver SIP" value={fc(goldSIP)} sub="/month" color='#fbbf24'/>
      </div>

      {/* Funds list */}
      {['Equity','Debt','Gold & Silver'].map(cat => {
        const funds = DATA.mutualFunds.filter(f=>f.cat===cat)
        const catSIP = funds.reduce((s,f)=>s+f.sip,0)
        const clr = CAT_COLOR[cat]
        return (
          <div className="card" key={cat}>
            <div className="card-header">
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:clr.bg,color:clr.color,border:`1px solid ${clr.border}`}}>{cat}</span>
                <span style={{fontSize:12,color:'var(--text3)'}}>{funds.length} funds</span>
              </div>
              <span style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:600,color:clr.color}}>{fc(catSIP)}/mo</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fund Name</th>
                    <th>Folio</th>
                    <th>SIP Date</th>
                    <th style={{textAlign:'right'}}>SIP Amount</th>
                    <th>Platform</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {funds.map((f,i)=>(
                    <tr key={i}>
                      <td style={{maxWidth:200}}>
                        <div style={{fontSize:12,color:'var(--text)',fontWeight:500,lineHeight:1.4}}>{f.name}</div>
                      </td>
                      <td style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text3)'}}>{f.folio}</td>
                      <td style={{fontFamily:"'DM Mono',monospace",fontSize:12}}>{f.sipDate}</td>
                      <td style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:600,color:clr.color}}>
                        {f.sipDate==='Hold'?<span style={{color:'var(--amber)'}}>On Hold</span>:fc(f.sip)}
                      </td>
                      <td style={{fontSize:11,color:'var(--text2)'}}>{f.consultant}</td>
                      <td style={{fontSize:11,color:'var(--text3)'}}>{f.bank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InsuranceTab() {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        <StatCard icon="🛡️" label="Total Policies" value={DATA.insurance.length} sub="active" color='var(--accent2)'/>
        <StatCard icon="💰" label="Annual Premium" value={fc(totalInsurance)} sub="total outgo" color='var(--red)'/>
        <StatCard icon="📅" label="Monthly Equiv" value={fc(Math.round(totalInsurance/12))} sub="avg per month" color='var(--amber)'/>
      </div>

      {/* Policy cards */}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {DATA.insurance.map((ins,i)=>(
          <div key={i} className="card" style={{padding:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10}}>
              <div>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                  <span style={{
                    fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:700,
                    background: ins.type.includes('Term')?'#ef444415':'#22c55e15',
                    color: ins.type.includes('Term')?'var(--red)':'var(--green)',
                    border: `1px solid ${ins.type.includes('Term')?'#ef444433':'#22c55e33'}`,
                  }}>{ins.type}</span>
                </div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:4}}>{ins.provider}</div>
                <div style={{fontSize:12,color:'var(--text3)',display:'flex',gap:16,flexWrap:'wrap'}}>
                  <span>👤 {ins.holder}</span>
                  <span>📋 Policy: {ins.policy.toString().slice(0,12)}...</span>
                  <span>🏦 {ins.bank}</span>
                  <span>📅 Due: {ins.due}</span>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>ANNUAL PREMIUM</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:20,color:'var(--red)'}}>{fc(ins.premium)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment schedule */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📅 Payment Schedule</span>
          <span style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--red)',fontWeight:600}}>
            {fc(totalPayments)}/year total
          </span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Due Date</th>
                <th>Provider</th>
                <th>Beneficiary</th>
                <th style={{textAlign:'right'}}>Premium</th>
                <th style={{textAlign:'center'}}>2025-26</th>
                <th style={{textAlign:'center'}}>2026-27</th>
              </tr>
            </thead>
            <tbody>
              {DATA.payments.map((p,i)=>(
                <tr key={i}>
                  <td style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--amber)'}}>{p.due}</td>
                  <td style={{fontSize:12,color:'var(--text)'}}>{p.provider}</td>
                  <td style={{fontSize:12,color:'var(--text2)'}}>{p.beneficiary}</td>
                  <td style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:600,color:'var(--red)'}}>{fc(p.premium)}</td>
                  <td style={{textAlign:'center'}}>
                    <span style={{fontSize:16}}>{p.paid2526 ? '✅' : '❌'}</span>
                  </td>
                  <td style={{textAlign:'center'}}>
                    <span style={{fontSize:16}}>{p.paid2627 ? '✅' : '⏳'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background:'var(--bg2)'}}>
                <td colSpan={3} style={{fontWeight:700}}>TOTAL ANNUAL OUTGO</td>
                <td style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--red)',fontSize:14}}>{fc(totalPayments)}</td>
                <td colSpan={2}/>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function EmergencyTab() {
  const totalCurrent = DATA.emergency.reduce((s,e)=>s+e.current,0)
  const totalTarget  = DATA.emergency.reduce((s,e)=>s+e.target, 0)
  const pct = Math.round((totalCurrent/totalTarget)*100)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* Summary */}
      <div className="card" style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div>
            <div style={{fontSize:12,color:'var(--text3)',fontWeight:600,marginBottom:4}}>EMERGENCY FUND STATUS</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:28,fontWeight:700,color:pct>=80?'var(--green)':'var(--amber)'}}>{fc(totalCurrent)}</div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>of {fc(totalTarget)} target ({pct}%)</div>
          </div>
          <div style={{position:'relative',width:80,height:80}}>
            <svg viewBox="0 0 80 80" style={{transform:'rotate(-90deg)'}}>
              <circle cx={40} cy={40} r={32} fill="none" stroke="var(--border)" strokeWidth={8}/>
              <circle cx={40} cy={40} r={32} fill="none"
                stroke={pct>=80?'var(--green)':'var(--amber)'}
                strokeWidth={8}
                strokeDasharray={`${(pct/100)*201} 201`}
                strokeLinecap="round"
                style={{filter:`drop-shadow(0 0 6px ${pct>=80?'#22c55e':'#f59e0b'}88)`}}/>
            </svg>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14,color:pct>=80?'var(--green)':'var(--amber)'}}>{pct}%</span>
            </div>
          </div>
        </div>
        <div className="progress" style={{height:8,borderRadius:8}}>
          <div className="progress-fill" style={{
            width:`${pct}%`,
            background:pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--red)',
            borderRadius:8,
          }}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
          <span style={{fontSize:11,color:'var(--text3)'}}>Current: {fc(totalCurrent)}</span>
          <span style={{fontSize:11,color:'var(--text3)'}}>Gap: {fc(totalTarget-totalCurrent)} remaining</span>
        </div>
      </div>

      {/* Fund breakdown */}
      {DATA.emergency.map((e,i)=>{
        const p = Math.min(100,Math.round((e.current/e.target)*100))
        return (
          <div key={i} className="card" style={{padding:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:4}}>{e.institution}</div>
                <div style={{display:'flex',gap:10,fontSize:11,color:'var(--text3)',flexWrap:'wrap'}}>
                  <span style={{
                    padding:'2px 8px',borderRadius:20,
                    background: e.cat==='Instant Cash'?'#22c55e15':'#5865f215',
                    color: e.cat==='Instant Cash'?'var(--green)':'var(--accent2)',
                    fontWeight:600,
                  }}>{e.cat}</span>
                  <span>⚡ {e.liquidity}</span>
                  <span>📋 {e.account}</span>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:16,color:'var(--green)'}}>{fc(e.current)}</div>
                <div style={{fontSize:11,color:'var(--text3)'}}>of {fc(e.target)}</div>
              </div>
            </div>
            <div className="progress">
              <div className="progress-fill" style={{width:`${p}%`,background:p>=100?'var(--green)':p>=70?'var(--amber)':'var(--red)'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:5}}>
              <span style={{fontSize:10,color:'var(--text3)'}}>{p}% funded</span>
              <span style={{fontSize:10,color:e.current>=e.target?'var(--green)':'var(--red)'}}>
                {e.current>=e.target ? '✅ Target Met' : `₹${f(e.target-e.current)} to go`}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function PersonalFinance() {
  const [tab, setTab] = useState('overview')

  const tabs = [
    {id:'overview',   label:'Overview',      icon:'🏠'},
    {id:'stocks',     label:'My Stocks',     icon:'📈'},
    {id:'mf',         label:'Mutual Funds',  icon:'🔄'},
    {id:'insurance',  label:'Insurance',     icon:'🛡️'},
    {id:'emergency',  label:'Emergency Fund',icon:'🏦'},
  ]

  return (
    <div className="anim-fade" style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:'var(--text)'}}>
            💼 Anav's Personal Finance
          </div>
          <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
            Complete investment & insurance portfolio — Angel One · SIP · HDFC · LIC
          </div>
        </div>
        <div style={{marginLeft:'auto',textAlign:'right'}}>
          <div style={{fontSize:10,color:'var(--text3)',fontWeight:600,letterSpacing:.8}}>TOTAL INVESTED</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:22,color:'var(--accent2)'}}>
            {fc(totalStocksInvested + totalEmergency)}
          </div>
        </div>
      </div>

      {/* Inner tab bar */}
      <div style={{display:'flex',gap:4,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:4,overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        {tabs.map(t=>(
          <button key={t.id}
            className={`tab-btn ${tab===t.id?'active':''}`}
            onClick={()=>setTab(t.id)}
            style={{display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap',fontSize:12,padding:'6px 12px'}}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab==='overview'  && <OverviewTab/>}
      {tab==='stocks'    && <StocksTab/>}
      {tab==='mf'        && <MFTab/>}
      {tab==='insurance' && <InsuranceTab/>}
      {tab==='emergency' && <EmergencyTab/>}
    </div>
  )
}
