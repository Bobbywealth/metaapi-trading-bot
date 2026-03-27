const express = require('express');
const MetaApi = require('metaapi.cloud-sdk').default;
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const META_API_TOKEN = process.env.META_API_TOKEN;
const ACCOUNT_ID = process.env.META_API_ACCOUNT_ID;

let metaApi, account, connection;

async function initMetaApi() {
  try {
    metaApi = new MetaApi(META_API_TOKEN);
    account = await metaApi.metatraderAccountApi.getAccount(ACCOUNT_ID);
    if (account.state !== 'DEPLOYED') {
      console.log('Deploying account...');
      await account.deploy();
    }
    await account.waitConnected();
    connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    console.log('MetaApi connected and synchronized!');
  } catch (err) {
    console.error('MetaApi init error:', err.message);
  }
}

// ===== API ROUTES =====

app.get('/api/account', async (req, res) => {
  try {
    const info = await connection.getAccountInformation();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/positions', async (req, res) => {
  try {
    const positions = await connection.getPositions();
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await connection.getOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = new Date();
    const deals = await connection.getDealsByTimeRange(start, end);
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/price/:symbol', async (req, res) => {
  try {
    const tick = await connection.getSymbolPrice(req.params.symbol);
    res.json(tick);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trade', async (req, res) => {
  try {
    const { symbol, type, volume, stopLoss, takeProfit } = req.body;
    let result;
    if (type === 'buy') {
      result = await connection.createMarketBuyOrder(symbol, volume, stopLoss, takeProfit);
    } else {
      result = await connection.createMarketSellOrder(symbol, volume, stopLoss, takeProfit);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/close/:positionId', async (req, res) => {
  try {
    const result = await connection.closePosition(req.params.positionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/close-all', async (req, res) => {
  try {
    const positions = await connection.getPositions();
    const results = [];
    for (const pos of positions) {
      const r = await connection.closePosition(pos.id);
      results.push(r);
    }
    res.json({ closed: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== WEB DASHBOARD =====
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Trading Bot Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, sans-serif; background:#0f172a; color:#e2e8f0; padding:20px; }
.header { text-align:center; padding:20px 0; }
.header h1 { color:#38bdf8; font-size:28px; }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-top:20px; }
.card { background:#1e293b; border-radius:12px; padding:20px; border:1px solid #334155; }
.card h2 { color:#38bdf8; margin-bottom:15px; font-size:18px; }
.stat { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #334155; }
.stat-label { color:#94a3b8; }
.stat-value { color:#f1f5f9; font-weight:bold; }
.profit { color:#4ade80; } .loss { color:#f87171; }
btn, button { background:#2563eb; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-size:14px; margin:5px; }
btn:hover, button:hover { background:#1d4ed8; }
.sell-btn { background:#dc2626; } .sell-btn:hover { background:#b91c1c; }
select, input { background:#0f172a; color:#e2e8f0; border:1px solid #475569; padding:8px 12px; border-radius:6px; margin:4px; }
.trade-form { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
#positions-list, #orders-list { max-height:300px; overflow-y:auto; }
.pos-item { background:#0f172a; padding:10px; border-radius:8px; margin:8px 0; display:flex; justify-content:space-between; align-items:center; }
.status { padding:4px 12px; border-radius:20px; font-size:12px; }
.status.connected { background:#065f46; color:#6ee7b7; }
.status.disconnected { background:#7f1d1d; color:#fca5a5; }
#log { background:#020617; padding:10px; border-radius:8px; max-height:200px; overflow-y:auto; font-family:monospace; font-size:12px; margin-top:10px; }
</style></head><body>
<div class="header">
  <h1>MetaApi Trading Bot</h1>
  <p>MT5 Account Dashboard</p>
  <span id="conn-status" class="status disconnected">Connecting...</span>
</div>
<div class="grid">
  <div class="card">
    <h2>Account Info</h2>
    <div id="account-info"><p>Loading...</p></div>
  </div>
  <div class="card">
    <h2>Place Trade</h2>
    <div class="trade-form">
      <select id="symbol"><option>EURUSD</option><option>GBPUSD</option><option>USDJPY</option><option>XAUUSD</option><option>BTCUSD</option><option>US30</option><option>NAS100</option></select>
      <input id="volume" type="number" value="0.01" step="0.01" min="0.01" style="width:80px" placeholder="Lots">
      <input id="sl" type="number" placeholder="SL" style="width:80px">
      <input id="tp" type="number" placeholder="TP" style="width:80px">
      <button onclick="placeTrade('buy')">BUY</button>
      <button onclick="placeTrade('sell')" class="sell-btn">SELL</button>
    </div>
    <div id="trade-result" style="margin-top:10px"></div>
  </div>
  <div class="card">
    <h2>Open Positions <button onclick="closeAllPositions()" class="sell-btn" style="font-size:11px;padding:4px 10px">Close All</button></h2>
    <div id="positions-list"><p>Loading...</p></div>
  </div>
  <div class="card">
    <h2>Pending Orders</h2>
    <div id="orders-list"><p>Loading...</p></div>
  </div>
  <div class="card">
    <h2>Recent Deals (7d)</h2>
    <div id="history-list"><p>Loading...</p></div>
  </div>
  <div class="card">
    <h2>Activity Log</h2>
    <div id="log"></div>
  </div>
</div>
<script>
const BASE = '';
function log(msg) {
  const el = document.getElementById('log');
  el.innerHTML = new Date().toLocaleTimeString() + ' - ' + msg + '<br>' + el.innerHTML;
}

async function fetchAccount() {
  try {
    const r = await fetch(BASE + '/api/account');
    const d = await r.json();
    if (d.error) { log('Account error: ' + d.error); return; }
    document.getElementById('conn-status').className = 'status connected';
    document.getElementById('conn-status').textContent = 'Connected';
    const pClass = d.profit >= 0 ? 'profit' : 'loss';
    document.getElementById('account-info').innerHTML =
      '<div class="stat"><span class="stat-label">Balance</span><span class="stat-value">$' + d.balance?.toFixed(2) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Equity</span><span class="stat-value">$' + d.equity?.toFixed(2) + '</span></div>' +
      '<div class="stat"><span class="stat-label">P&L</span><span class="stat-value ' + pClass + '">$' + d.profit?.toFixed(2) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Margin</span><span class="stat-value">$' + d.margin?.toFixed(2) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Free Margin</span><span class="stat-value">$' + d.freeMargin?.toFixed(2) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Leverage</span><span class="stat-value">1:' + d.leverage + '</span></div>';
    log('Account loaded - Balance: $' + d.balance?.toFixed(2));
  } catch(e) { log('Fetch error: ' + e.message); }
}

async function fetchPositions() {
  try {
    const r = await fetch(BASE + '/api/positions');
    const d = await r.json();
    if (d.error) return;
    const el = document.getElementById('positions-list');
    if (!d.length) { el.innerHTML = '<p style="color:#64748b">No open positions</p>'; return; }
    el.innerHTML = d.map(p => {
      const pClass = p.profit >= 0 ? 'profit' : 'loss';
      return '<div class="pos-item"><div><strong>' + p.symbol + '</strong> ' + p.type + ' ' + p.volume + ' lots<br><span class="' + pClass + '">$' + p.profit?.toFixed(2) + '</span></div><button onclick="closePos(\'' + p.id + '\')" class="sell-btn" style="font-size:11px;padding:4px 10px">Close</button></div>';
    }).join('');
  } catch(e) {}
}

async function fetchOrders() {
  try {
    const r = await fetch(BASE + '/api/orders');
    const d = await r.json();
    if (d.error) return;
    const el = document.getElementById('orders-list');
    if (!d.length) { el.innerHTML = '<p style="color:#64748b">No pending orders</p>'; return; }
    el.innerHTML = d.map(o => '<div class="pos-item"><div><strong>' + o.symbol + '</strong> ' + o.type + ' ' + o.volume + ' lots @ ' + o.openPrice + '</div></div>').join('');
  } catch(e) {}
}

async function fetchHistory() {
  try {
    const r = await fetch(BASE + '/api/history');
    const d = await r.json();
    if (d.error) return;
    const el = document.getElementById('history-list');
    if (!d.length) { el.innerHTML = '<p style="color:#64748b">No recent deals</p>'; return; }
    el.innerHTML = d.slice(0, 20).map(h => '<div class="pos-item"><div><strong>' + h.symbol + '</strong> ' + h.type + '<br><span class="' + (h.profit >= 0 ? 'profit' : 'loss') + '">$' + h.profit?.toFixed(2) + '</span></div></div>').join('');
  } catch(e) {}
}

async function placeTrade(type) {
  const symbol = document.getElementById('symbol').value;
  const volume = parseFloat(document.getElementById('volume').value);
  const sl = parseFloat(document.getElementById('sl').value) || undefined;
  const tp = parseFloat(document.getElementById('tp').value) || undefined;
  log('Placing ' + type.toUpperCase() + ' ' + volume + ' ' + symbol + '...');
  try {
    const r = await fetch(BASE + '/api/trade', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ symbol, type, volume, stopLoss: sl, takeProfit: tp })
    });
    const d = await r.json();
    if (d.error) { log('Trade error: ' + d.error); document.getElementById('trade-result').innerHTML = '<span class="loss">' + d.error + '</span>'; return; }
    log('Trade executed: ' + JSON.stringify(d));
    document.getElementById('trade-result').innerHTML = '<span class="profit">Order placed!</span>';
    setTimeout(() => { fetchPositions(); fetchAccount(); }, 2000);
  } catch(e) { log('Trade error: ' + e.message); }
}

async function closePos(id) {
  log('Closing position ' + id + '...');
  try {
    await fetch(BASE + '/api/close/' + id, { method: 'POST' });
    log('Position closed');
    setTimeout(() => { fetchPositions(); fetchAccount(); }, 2000);
  } catch(e) { log('Close error: ' + e.message); }
}

async function closeAllPositions() {
  if (!confirm('Close ALL positions?')) return;
  log('Closing all positions...');
  try {
    const r = await fetch(BASE + '/api/close-all', { method: 'POST' });
    const d = await r.json();
    log('Closed ' + d.closed + ' positions');
    setTimeout(() => { fetchPositions(); fetchAccount(); }, 2000);
  } catch(e) { log('Error: ' + e.message); }
}

fetchAccount(); fetchPositions(); fetchOrders(); fetchHistory();
setInterval(() => { fetchAccount(); fetchPositions(); fetchOrders(); }, 10000);
</script></body></html>`);
});

// ===== START SERVER =====
app.listen(PORT, async () => {
  console.log('Trading bot running on port ' + PORT);
  await initMetaApi();
});
