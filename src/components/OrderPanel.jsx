import React, { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE_URL } from '../config'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fc = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const fN = n => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

async function apiCall(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`${API_BASE_URL}${path}`, opts)
  return r.json()
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ['Order', 'Orders', 'Positions', 'GTT']

// ── Order Form ────────────────────────────────────────────────────────────────
function OrderForm({ symbol, symbolToken, exchange, ltp, onClose, onSuccess }) {
  const [txn, setTxn]         = useState('BUY')  // BUY | SELL
  const [product, setProduct] = useState('CNC')  // CNC | MIS | NRML
  const [orderType, setOT]    = useState('MARKET')
  const [qty, setQty]         = useState(1)
  const [price, setPrice]     = useState(ltp || 0)
  const [trigger, setTrigger] = useState(0)
  const [sl, setSL]           = useState(0)       // for bracket orders
  const [target, setTarget]   = useState(0)       // for bracket orders
  const [validity, setValidity] = useState('DAY')
  const [variety, setVariety] = useState('NORMAL')
  const [tag, setTag]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // GTT mode (auto trigger)
  const [gttMode, setGttMode]     = useState(false)
  const [gttType, setGttType]     = useState('SINGLE') // SINGLE | OCO
  const [gttTarget, setGttTarget] = useState(ltp ? ltp * 1.05 : 0)
  const [gttSL, setGttSL]         = useState(ltp ? ltp * 0.95 : 0)
  const [gttTrigger, setGttTrigger] = useState(ltp || 0)
  const [gttPrice, setGttPrice]   = useState(ltp || 0)

  const estValue = qty * (orderType === 'MARKET' ? (ltp || price) : price)

  async function submit() {
    setError('')
    setLoading(true)
    try {
      if (gttMode) {
        // Place GTT rule
        const req = {
          symbol, symbolToken,
          exchange: exchange || 'NSE',
          triggerType: gttType,
          ltp: ltp || 0,
          triggerPrice: gttTrigger,
          price: gttPrice,
          quantity: qty,
          transactionType: txn,
          targetPrice: gttTarget,
          stopLossPrice: gttSL,
        }
        const res = await apiCall('/api/gtt/place', 'POST', req)
        if (res.error) { setError(res.error); return }
        onSuccess?.(`GTT placed! Rule ID: ${res.orderId}`)
      } else {
        const req = {
          symbol, symbolToken,
          instrumentKey: '',
          exchange: exchange || 'NSE',
          quantity: Number(qty),
          price: Number(price),
          triggerPrice: Number(trigger),
          orderType,
          transactionType: txn,
          product,
          variety,
          squareOff: Number(target),
          stopLoss: Number(sl),
          validity,
          tag,
        }
        const res = await apiCall('/api/order/place', 'POST', req)
        if (res.error) { setError(res.error); return }
        onSuccess?.(`Order placed! ID: ${res.orderId}`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const BUY_CLR  = '#22c55e'
  const SELL_CLR = '#ef4444'
  const clr = txn === 'BUY' ? BUY_CLR : SELL_CLR

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* BUY / SELL toggle */}
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {['BUY','SELL'].map(t => (
          <button key={t} onClick={() => setTxn(t)} style={{
            flex: 1, padding: '10px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none',
            fontFamily: "'Syne',sans-serif", letterSpacing: 1,
            background: txn === t ? (t === 'BUY' ? BUY_CLR : SELL_CLR) : 'var(--surface)',
            color: txn === t ? '#fff' : 'var(--text3)',
            transition: 'all .15s',
          }}>{t}</button>
        ))}
      </div>

      {/* Symbol info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg2)', padding: '8px 12px', borderRadius: 6 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'DM Mono',monospace" }}>{symbol}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{exchange} · {symbolToken}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: clr, fontFamily: "'DM Mono',monospace" }}>{fc(ltp)}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>LTP</div>
        </div>
      </div>

      {/* GTT Toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        padding: '8px 12px', background: gttMode ? '#f59e0b15' : 'var(--surface)',
        border: `1px solid ${gttMode ? '#f59e0b' : 'var(--border)'}`, borderRadius: 6 }}>
        <input type="checkbox" checked={gttMode} onChange={e => setGttMode(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: '#f59e0b' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: gttMode ? '#f59e0b' : 'var(--text2)' }}>
          🎯 GTT — Auto trigger at price (order places automatically)
        </span>
      </label>

      {gttMode ? (
        /* GTT Form */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* OCO toggle */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['SINGLE','OCO'].map(t => (
              <button key={t} onClick={() => setGttType(t)} style={{
                flex: 1, padding: '7px 0', borderRadius: 6, border: `1px solid ${gttType===t ? clr : 'var(--border)'}`,
                background: gttType===t ? clr+'18' : 'var(--surface)',
                color: gttType===t ? clr : 'var(--text3)', cursor: 'pointer', fontWeight: 600, fontSize: 12,
              }}>
                {t === 'SINGLE' ? '📍 Single Trigger' : '🔄 OCO (Target + SL)'}
              </button>
            ))}
          </div>

          <Row label="Quantity">
            <NumInput value={qty} onChange={setQty} min={1} step={1} />
          </Row>

          {gttType === 'SINGLE' ? (
            <>
              <Row label="Trigger Price"><NumInput value={gttTrigger} onChange={setGttTrigger} step={0.05} /></Row>
              <Row label="Order Price"><NumInput value={gttPrice} onChange={setGttPrice} step={0.05} /></Row>
            </>
          ) : (
            <>
              <Row label="Target Price ✅"><NumInput value={gttTarget} onChange={setGttTarget} step={0.05} /></Row>
              <Row label="Stop-Loss Price 🛡️"><NumInput value={gttSL} onChange={setGttSL} step={0.05} /></Row>
            </>
          )}

          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 2px' }}>
            GTT rule stays active until triggered — no expiry. Works even when app is closed.
          </div>
        </div>
      ) : (
        /* Normal Order Form */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Product */}
          <Row label="Product">
            <SegControl value={product} onChange={setProduct}
              options={[{v:'CNC',l:'CNC'},{v:'MIS',l:'MIS'},{v:'NRML',l:'NRML'}]} color={clr} />
          </Row>

          {/* Order Type */}
          <Row label="Order Type">
            <SegControl value={orderType} onChange={setOT}
              options={[{v:'MARKET',l:'MKT'},{v:'LIMIT',l:'LMT'},{v:'SL',l:'SL'},{v:'SL-M',l:'SL-M'}]}
              color={clr} />
          </Row>

          {/* Quantity */}
          <Row label="Qty">
            <NumInput value={qty} onChange={setQty} min={1} step={1} />
          </Row>

          {/* Price — hide for MARKET */}
          {orderType !== 'MARKET' && (
            <Row label="Price">
              <NumInput value={price} onChange={setPrice} step={0.05} />
            </Row>
          )}

          {/* Trigger — show for SL/SL-M */}
          {(orderType === 'SL' || orderType === 'SL-M') && (
            <Row label="Trigger Price">
              <NumInput value={trigger} onChange={setTrigger} step={0.05} />
            </Row>
          )}

          {/* Bracket order fields (ROBO variety) */}
          {variety === 'ROBO' && (
            <>
              <Row label="Target"><NumInput value={target} onChange={setTarget} step={0.05} /></Row>
              <Row label="Stop-Loss"><NumInput value={sl} onChange={setSL} step={0.05} /></Row>
            </>
          )}

          {/* Variety */}
          <Row label="Variety">
            <SegControl value={variety} onChange={v => { setVariety(v); if(v==='ROBO') setOT('LIMIT') }}
              options={[{v:'NORMAL',l:'Normal'},{v:'STOPLOSS',l:'SL'},{v:'AMO',l:'AMO'},{v:'ROBO',l:'Bracket'}]}
              color={clr} small />
          </Row>

          {/* Validity */}
          <Row label="Validity">
            <SegControl value={validity} onChange={setValidity}
              options={[{v:'DAY',l:'DAY'},{v:'IOC',l:'IOC'}]} color={clr} />
          </Row>

          {/* Est value */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0',
            borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
            <span>Estimated Value</span>
            <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>
              {fc(estValue)}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 12px', background: '#ef444415', border: '1px solid #ef4444',
          borderRadius: 6, color: '#ef4444', fontSize: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Submit */}
      <button onClick={submit} disabled={loading} style={{
        padding: '13px 0', borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
        background: loading ? 'var(--surface)' : clr, color: '#fff',
        fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15,
        opacity: loading ? 0.6 : 1, transition: 'all .15s',
      }}>
        {loading ? '⏳ Placing...' : gttMode ? `🎯 Place GTT` : `${txn} ${symbol}`}
      </button>
    </div>
  )
}

// ── Order Book ─────────────────────────────────────────────────────────────────
function OrderBook() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await apiCall('/api/orders')
      setOrders(d.orders || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function cancel(o) {
    setCancelling(o.orderId)
    try {
      await apiCall('/api/order/cancel', 'POST', { orderId: o.orderId, variety: o.variety || 'NORMAL' })
      await load()
    } catch {}
    setCancelling(null)
  }

  const STATUS_COLOR = {
    complete: '#22c55e', open: '#3b82f6', cancelled: 'var(--text3)',
    rejected: '#ef4444', pending: '#f59e0b',
  }

  if (loading) return <Spinner />
  if (!orders.length) return <Empty msg="No orders today" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {orders.map((o, i) => (
        <div key={o.orderId || i} style={{ padding: '10px 14px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* TXN badge */}
          <span style={{ fontWeight: 700, fontSize: 11, padding: '3px 8px', borderRadius: 4,
            background: o.transactionType === 'BUY' ? '#22c55e20' : '#ef444420',
            color: o.transactionType === 'BUY' ? '#22c55e' : '#ef4444',
            fontFamily: "'DM Mono',monospace" }}>
            {o.transactionType}
          </span>
          {/* Symbol + details */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{o.symbol}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {o.orderType} · {o.product} · Qty: {o.filledQty}/{o.quantity}
              {o.avgPrice > 0 && ` @ ${fc(o.avgPrice)}`}
            </div>
          </div>
          {/* Status */}
          <span style={{ fontSize: 12, fontWeight: 600,
            color: STATUS_COLOR[o.status] || 'var(--text3)' }}>
            {o.status?.toUpperCase()}
          </span>
          {/* Cancel btn for open orders */}
          {(o.status === 'open' || o.status === 'pending') && (
            <button onClick={() => cancel(o)} disabled={cancelling === o.orderId}
              style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #ef4444',
                background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>
              {cancelling === o.orderId ? '...' : 'Cancel'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Positions ─────────────────────────────────────────────────────────────────
function Positions() {
  const [positions, setPositions] = useState([])
  const [funds, setFunds] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([apiCall('/api/positions'), apiCall('/api/funds')])
      .then(([p, f]) => {
        setPositions(p.positions || [])
        setFunds(f)
      }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Funds bar */}
      {funds && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            { l: 'Available Cash', v: fc(funds.availableCash), c: '#22c55e' },
            { l: 'Used Margin', v: fc(funds.usedMargin), c: '#f59e0b' },
            { l: 'Total', v: fc(funds.totalBalance), c: 'var(--text)' },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ padding: '10px 12px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{l}</div>
              <div style={{ fontWeight: 700, color: c, fontFamily: "'DM Mono',monospace", fontSize: 14 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {!positions.length
        ? <Empty msg="No open positions" />
        : positions.map((p, i) => {
          const pnlClr = p.pnl >= 0 ? '#22c55e' : '#ef4444'
          return (
            <div key={i} style={{ padding: '10px 14px', background: 'var(--surface)',
              border: `1px solid ${p.pnl >= 0 ? '#22c55e30' : '#ef444430'}`, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.symbol}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {p.product} · {p.transactionType} · Qty: {p.quantity}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    Avg: {fc(p.buyPrice || p.sellPrice)} · LTP: {fc(p.ltp)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: pnlClr, fontFamily: "'DM Mono',monospace", fontSize: 14 }}>
                    {p.pnl >= 0 ? '+' : ''}{fc(p.pnl)}
                  </div>
                  <div style={{ fontSize: 11, color: pnlClr }}>Unrealized: {fc(p.unrealizedPnl)}</div>
                </div>
              </div>
            </div>
          )
        })
      }
    </div>
  )
}

// ── GTT List ──────────────────────────────────────────────────────────────────
function GTTList() {
  const [gtts, setGtts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await apiCall('/api/gtt/list')
      setGtts(d.gtts || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function cancel(id) {
    setCancelling(id)
    try {
      await apiCall('/api/gtt/cancel', 'POST', { taskId: String(id) })
      await load()
    } catch {}
    setCancelling(null)
  }

  if (loading) return <Spinner />
  if (!gtts.length) return <Empty msg="No active GTT rules" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {gtts.map((g, i) => (
        <div key={g.id || i} style={{ padding: '10px 14px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{g.tradingsymbol || g.symbol}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {g.type} · Trigger: {fc(g.triggerprice || 0)} · Qty: {g.qty}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              Status: {g.status} · ID: {g.id}
            </div>
          </div>
          <button onClick={() => cancel(g.id)} disabled={cancelling === g.id}
            style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #ef4444',
              background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>
            {cancelling === g.id ? '...' : 'Delete'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Shared UI bits ─────────────────────────────────────────────────────────────
function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text3)', minWidth: 90 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function NumInput({ value, onChange, min = 0, step = 1 }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
      <button onClick={() => onChange(v => Math.max(min, Number((Number(v) - step).toFixed(2))))}
        style={{ padding: '6px 11px', background: 'var(--bg2)', border: 'none', color: 'var(--text2)',
          cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>−</button>
      <input type="number" value={value}
        onChange={e => onChange(Number(e.target.value))} min={min} step={step}
        style={{ flex: 1, textAlign: 'center', border: 'none', background: 'var(--surface)',
          color: 'var(--text)', fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600,
          outline: 'none', width: 0 }} />
      <button onClick={() => onChange(v => Number((Number(v) + step).toFixed(2)))}
        style={{ padding: '6px 11px', background: 'var(--bg2)', border: 'none', color: 'var(--text2)',
          cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>+</button>
    </div>
  )
}

function SegControl({ value, onChange, options, color, small }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          padding: small ? '4px 9px' : '5px 12px',
          borderRadius: 5, border: `1px solid ${value === o.v ? color : 'var(--border)'}`,
          background: value === o.v ? color + '20' : 'var(--surface)',
          color: value === o.v ? color : 'var(--text3)',
          fontWeight: value === o.v ? 700 : 500, fontSize: small ? 11 : 12, cursor: 'pointer',
          fontFamily: "'DM Mono',monospace",
        }}>{o.l}</button>
      ))}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 24, height: 24, border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

function Empty({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text3)', fontSize: 13 }}>
      {msg}
    </div>
  )
}

// ── Main OrderPanel Export ────────────────────────────────────────────────────
// defaultTab: 'Order' | 'Orders' | 'Positions' | 'GTT'
export default function OrderPanel({ symbol, symbolToken, exchange, ltp, onClose, defaultTab = 'Order' }) {
  const [tab, setTab] = useState(defaultTab)
  const [toast, setToast] = useState('')
  const panelRef = useRef(null)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1998,
        backdropFilter: 'blur(2px)',
      }} />

      {/* Panel */}
      <div ref={panelRef} style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 380, maxWidth: '100vw',
        background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        zIndex: 1999, display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(0,0,0,.5)',
        animation: 'slideInRight .2s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--surface)' }}>
          <div>
            <div style={{ fontWeight: 700, fontFamily: "'Syne',sans-serif", fontSize: 15 }}>
              Trade — {symbol}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Angel One SmartAPI</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: 'var(--text3)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              background: 'transparent', color: tab === t ? 'var(--accent2)' : 'var(--text3)',
              fontFamily: "'DM Sans',sans-serif", transition: 'all .15s',
            }}>{t}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {tab === 'Order'     && <OrderForm symbol={symbol} symbolToken={symbolToken} exchange={exchange}
                                   ltp={ltp} onClose={onClose} onSuccess={msg => { showToast(msg); setTab('Orders') }} />}
          {tab === 'Orders'    && <OrderBook />}
          {tab === 'Positions' && <Positions />}
          {tab === 'GTT'       && <GTTList />}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, padding: '12px 16px',
            background: '#22c55e', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 13,
            boxShadow: '0 4px 20px rgba(34,197,94,.4)', zIndex: 10 }}>
            ✅ {toast}
          </div>
        )}

        {/* Keyframe injected once */}
        <style>{`
          @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
          @keyframes spin { to { transform: rotate(360deg) } }
        `}</style>
      </div>
    </>
  )
}
