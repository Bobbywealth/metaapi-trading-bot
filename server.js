const express = require('express');
const path = require('path');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize MetaAPI (use environment variable METAAPI_TOKEN)
const metaapiToken = process.env.METAAPI_TOKEN;
let metaApi = null;
let metaApiConnection = null;

async function initMetaApi() {
  if (!metaapiToken) {
    console.log('METAAPI_TOKEN not set, running in demo mode');
    return false;
  }
  try {
    metaApi = new MetaApi(metaapiToken);
    // Get first available account or use a specific one
    const accounts = await metaApi.accounts.getAccounts();
    if (accounts.length > 0) {
      metaApiConnection = await accounts[0].connect();
      console.log('Connected to MetaAPI account:', accounts[0].id);
      return true;
    }
  } catch (err) {
    console.error('MetaAPI connection error:', err.message);
  }
  return false;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    metaapi: metaApiConnection ? 'connected' : 'demo mode'
  });
});

// Get account info
app.get('/api/account', async (req, res) => {
  if (!metaApiConnection) {
    return res.json({
      demo: true,
      balance: 10000,
      equity: 10000,
      platform: 'MetaTrader'
    });
  }
  try {
    const account = metaApiConnection.account;
    res.json({
      id: account.id,
      balance: account.balance,
      equity: account.equity,
      platform: account.platform
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get positions
app.get('/api/positions', async (req, res) => {
  if (!metaApiConnection) {
    return res.json({ positions: [], demo: true });
  }
  try {
    const positions = await metaApiConnection.positions;
    res.json({ positions, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get open positions
app.get('/api/positions/open', async (req, res) => {
  if (!metaApiConnection) {
    return res.json({ positions: [
      { id: '1', symbol: 'EURUSD', type: 'POSITION_TYPE_BUY', volume: 0.01, price: 1.0850, profit: 5.00 },
      { id: '2', symbol: 'XAUUSD', type: 'POSITION_TYPE_BUY', volume: 0.10, price: 2050.00, profit: 50.00 }
    ], demo: true });
  }
  try {
    const positions = await metaApiConnection.positions;
    const openPositions = positions.filter(p => p.state === 'POSITION_STATE_OPENING');
    res.json({ positions: openPositions, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get market data
app.get('/api/market/:symbol', async (req, res) => {
  const { symbol } = req.params;
  if (!metaApiConnection) {
    // Demo data
    const demoData = {
      EURUSD: { price: 1.0850, change: 0.0012 },
      GBPUSD: { price: 1.2650, change: -0.0008 },
      USDJPY: { price: 149.50, change: 0.0005 },
      XAUUSD: { price: 2050.00, change: 0.0045 },
      BTCUSD: { price: 43000, change: 0.0123 }
    };
    return res.json(demoData[symbol] || { price: 0, change: 0, demo: true });
  }
  try {
    const terminal = metaApiConnection.terminal;
    const stream = await terminal.getPriceStream(symbol);
    // For now return last known price
    res.json({ symbol, price: 0, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Place order
app.post('/api/order', async (req, res) => {
  const { symbol, volume, side, type = 'MARKET' } = req.body;
  
  if (!metaApiConnection) {
    return res.json({ 
      success: true, 
      demo: true, 
      orderId: 'demo-' + Date.now(),
      message: 'Demo order placed (no MetaAPI connection)'
    });
  }
  
  try {
    const terminal = metaApiConnection.terminal;
    const lot = volume || 0.01;
    const orderType = side === 'BUY' ? 'MARKET_BUY' : 'MARKET_SELL';
    
    const result = await terminal.placeMarketOrder(symbol, lot, orderType, { 
      comment: 'AI Trading Station' 
    });
    
    res.json({ success: true, orderId: result.id, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close position
app.delete('/api/position/:id', async (req, res) => {
  const { id } = req.params;
  
  if (!metaApiConnection) {
    return res.json({ success: true, demo: true, message: 'Demo: position closed' });
  }
  
  try {
    const terminal = metaApiConnection.terminal;
    await terminal.closePosition(id);
    res.json({ success: true, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start
initMetaApi().then(connected => {
  console.log('MetaAPI status:', connected ? 'LIVE TRADING' : 'DEMO MODE');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

module.exports = app;
