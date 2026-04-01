const express = require('express');
const path = require('path');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== METAAPI STATE =====
const metaapiToken = process.env.META_API_TOKEN;
const metaapiAccountId = process.env.META_API_ACCOUNT_ID;
let metaApi = null;
let account = null;
let connection = null;
let connected = false;

// ===== ANTI-LOCK GUARDS =====
let initInProgress = false;
let lastInitTime = 0;
const INIT_COOLDOWN_MS = 30000; // 30 second cooldown between attempts
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let healthCheckInterval = null;

// ===== INIT METAAPI WITH GUARDS =====
async function initMetaApi() {
  // Guard 1: concurrent init prevention
  if (initInProgress) {
    console.log('[guard] initMetaApi already in progress, skipping');
    return false;
  }

  // Guard 2: cooldown between attempts
  const now = Date.now();
  if (now - lastInitTime < INIT_COOLDOWN_MS) {
    console.log('[guard] cooldown active, skipping init (' + Math.round((INIT_COOLDOWN_MS - (now - lastInitTime)) / 1000) + 's remaining)');
    return false;
  }

  if (!metaapiToken || !metaapiAccountId) {
    console.log('META_API_TOKEN or META_API_ACCOUNT_ID not set, running in demo mode');
    return false;
  }

  initInProgress = true;
  lastInitTime = now;

  try {
    // Close existing connection if any
    if (connection) {
      try { await connection.close(); } catch(e) {}
      connection = null; account = null; metaApi = null;
      connected = false;
    }

    metaApi = new MetaApi(metaapiToken);
    account = await metaApi.metatraderAccountApi.getAccount(metaapiAccountId);

    if (account.state !== 'DEPLOYED') {
      await account.deploy();
    }
    await account.waitConnected();

    connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    connected = true;
    reconnectAttempts = 0;
    console.log('MetaApi connected! Server:', account.server);

    // Start health check interval
    startHealthCheck();
    return true;
  } catch (err) {
    connected = false;
    console.error('MetaAPI connection error:', err.message);
    return false;
  } finally {
    initInProgress = false;
  }
}

// ===== HEALTH CHECK + AUTO-RECONNECT WITH BACKOFF =====
function startHealthCheck() {
  if (healthCheckInterval) clearInterval(healthCheckInterval);

  healthCheckInterval = setInterval(async () => {
    if (!connected || !connection) return;

    try {
      await connection.getAccountInformation();
      // Connection is healthy
      reconnectAttempts = 0;
    } catch (err) {
      console.error('[health] Connection lost:', err.message);
      connected = false;

      // Auto-reconnect with backoff
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = reconnectAttempts * 30000; // 30s, 60s, 90s, 120s, 150s
        console.log('[health] Reconnect attempt ' + reconnectAttempts + '/' + MAX_RECONNECT_ATTEMPTS + ' in ' + (delay / 1000) + 's');
        setTimeout(async () => {
          lastInitTime = 0; // Reset cooldown for reconnect
          await initMetaApi();
        }, delay);
      } else {
        console.error('[health] Max reconnect attempts reached. Manual restart needed.');
      }
    }
  }, 60000); // Check every 60 seconds
}

// ===== API ROUTES =====

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    metaapi: connected ? 'connected' : 'demo mode',
    server: account?.server || null,
    reconnectAttempts,
    initInProgress,
    cooldownActive: (Date.now() - lastInitTime) < INIT_COOLDOWN_MS
  });
});

// Get account info
app.get('/api/account', async (req, res) => {
  if (!connected || !connection) {
    return res.json({
      demo: true,
      balance: 10000,
      equity: 10000,
      platform: 'MetaTrader'
    });
  }
  try {
    const info = await connection.getAccountInformation();
    res.json({
      id: metaapiAccountId,
      balance: info.balance,
      equity: info.equity,
      profit: info.profit || 0,
      margin: info.margin || 0,
      freeMargin: info.freeMargin || 0,
      leverage: info.leverage || 0,
      server: account.server,
      platform: info.platform || 'mt5',
      demo: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get positions
app.get('/api/positions', async (req, res) => {
  if (!connected || !connection) {
    return res.json({ positions: [], demo: true });
  }
  try {
    const positions = await connection.getPositions();
    res.json({ positions, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get open positions
app.get('/api/positions/open', async (req, res) => {
  if (!connected || !connection) {
    return res.json({ positions: [
      { id: '1', symbol: 'EURUSD', type: 'POSITION_TYPE_BUY', volume: 0.01, price: 1.0850, profit: 5.00 },
      { id: '2', symbol: 'XAUUSD', type: 'POSITION_TYPE_BUY', volume: 0.10, price: 2050.00, profit: 50.00 }
    ], demo: true });
  }
  try {
    const positions = await connection.getPositions();
    res.json({ positions, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get market data
app.get('/api/market/:symbol', async (req, res) => {
  const { symbol } = req.params;
  if (!connected || !connection) {
    const demoData = {
      EURUSD: { symbol: 'EURUSD', price: 1.0850, bid: 1.0849, ask: 1.0851, change: 0.0012 },
      GBPUSD: { symbol: 'GBPUSD', price: 1.2650, bid: 1.2649, ask: 1.2651, change: -0.0008 },
      USDJPY: { symbol: 'USDJPY', price: 149.50, bid: 149.49, ask: 149.51, change: 0.0005 },
      XAUUSD: { symbol: 'XAUUSD', price: 2050.00, bid: 2049.80, ask: 2050.20, change: 0.0045 },
      BTCUSD: { symbol: 'BTCUSD', price: 43000, bid: 42990, ask: 43010, change: 0.0123 }
    };
    return res.json(demoData[symbol] || { symbol, price: 0, change: 0, demo: true });
  }
  try {
    const tick = await connection.getSymbolPrice(symbol);
    res.json({
      symbol,
      price: tick.bid,
      bid: tick.bid,
      ask: tick.ask,
      spread: tick.ask && tick.bid ? ((tick.ask - tick.bid) * 100000).toFixed(1) : null,
      demo: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Place order
app.post('/api/order', async (req, res) => {
  const { symbol, volume, side, type = 'MARKET' } = req.body;

  if (!connected || !connection) {
    return res.json({
      success: true,
      demo: true,
      orderId: 'demo-' + Date.now(),
      message: 'Demo order placed (no MetaAPI connection)'
    });
  }

  try {
    const vol = parseFloat(volume) || 0.01;
    let result;
    if (side === 'BUY' || side === 'buy') {
      result = await connection.createMarketBuyOrder(symbol, vol);
    } else {
      result = await connection.createMarketSellOrder(symbol, vol);
    }
    res.json({ success: true, orderId: result.orderId, positionId: result.positionId, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close position
app.delete('/api/position/:id', async (req, res) => {
  const { id } = req.params;

  if (!connected || !connection) {
    return res.json({ success: true, demo: true, message: 'Demo: position closed' });
  }

  try {
    await connection.closePosition(id);
    res.json({ success: true, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close all positions
app.post('/api/close-all', async (req, res) => {
  if (!connected || !connection) {
    return res.json({ success: true, demo: true, closed: 0 });
  }
  try {
    const positions = await connection.getPositions();
    const results = [];
    for (const pos of positions) {
      try {
        results.push({ id: pos.id, result: await connection.closePosition(pos.id) });
      } catch(e) {
        results.push({ id: pos.id, error: e.message });
      }
    }
    res.json({ closed: results.filter(r => r.result).length, results, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get deal history
app.get('/api/history', async (req, res) => {
  if (!connected || !connection) {
    return res.json({ deals: [], demo: true });
  }
  try {
    const days = parseInt(req.query.days) || 7;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const end = new Date();
    const deals = await connection.getDealsByTimeRange(start, end);
    res.json({ deals, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== START SERVER FIRST, THEN CONNECT =====
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});

// Connect to MetaApi after server is listening
initMetaApi().then(ok => {
  console.log('MetaAPI status:', ok ? 'LIVE TRADING' : 'DEMO MODE');
});

module.exports = app;
