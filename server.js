const express = require('express');
const MetaApi = require('metaapi.cloud-sdk').default;
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const META_API_TOKEN = process.env.META_API_TOKEN;
const ACCOUNT_ID = process.env.META_API_ACCOUNT_ID;

let metaApi, account, connection;

// In-memory journal storage (resets on redeploy)
let journalEntries = [];

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

// ===== TRADING API ROUTES =====
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
    const vol = parseFloat(volume);
    if (!symbol || !type || isNaN(vol) || vol <= 0) {
      return res.status(400).json({ error: 'Invalid trade parameters.' });
    }
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;
    let result;
    console.log('Placing trade:', type, symbol, vol, 'SL:', sl, 'TP:', tp);
    if (type === 'buy') {
      result = await connection.createMarketBuyOrder(symbol, vol, sl, tp);
    } else if (type === 'sell') {
      result = await connection.createMarketSellOrder(symbol, vol, sl, tp);
    } else {
      return res.status(400).json({ error: 'Type must be buy or sell' });
    }
    // Auto-add to journal
    journalEntries.push({
      id: Date.now(),
      date: new Date().toISOString(),
      symbol: symbol,
      type: type,
      volume: vol,
      result: result.stringCode || 'executed',
      pnl: 0,
      notes: 'Auto-logged trade',
      tags: ['auto']
    });
    console.log('Trade result:', JSON.stringify(result));
    res.json(result);
  } catch (err) {
    console.error('Trade error:', err.message);
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

// ===== JOURNAL API ROUTES =====
app.get('/api/journal', (req, res) => {
  res.json(journalEntries);
});

app.post('/api/journal', (req, res) => {
  const { date, symbol, type, volume, pnl, notes, tags, emotion, setup, screenshot } = req.body;
  const entry = {
    id: Date.now(),
    date: date || new Date().toISOString(),
    symbol: symbol || '',
    type: type || '',
    volume: parseFloat(volume) || 0,
    pnl: parseFloat(pnl) || 0,
    notes: notes || '',
    tags: tags || [],
    emotion: emotion || '',
    setup: setup || '',
    screenshot: screenshot || ''
  };
  journalEntries.push(entry);
  res.json(entry);
});

app.put('/api/journal/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = journalEntries.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
  journalEntries[idx] = { ...journalEntries[idx], ...req.body, id: id };
  res.json(journalEntries[idx]);
});

app.delete('/api/journal/:id', (req, res) => {
  const id = parseInt(req.params.id);
  journalEntries = journalEntries.filter(e => e.id !== id);
  res.json({ deleted: true });
});

app.get('/api/journal/stats', (req, res) => {
  const total = journalEntries.length;
  const wins = journalEntries.filter(e => e.pnl > 0).length;
  const losses = journalEntries.filter(e => e.pnl < 0).length;
  const totalPnl = journalEntries.reduce((s, e) => s + (e.pnl || 0), 0);
  const avgPnl = total > 0 ? totalPnl / total : 0;
  res.json({ total, wins, losses, winRate: total > 0 ? ((wins/total)*100).toFixed(1) : 0, totalPnl: totalPnl.toFixed(2), avgPnl: avgPnl.toFixed(2) });
});

// ===== SERVE DASHBOARD =====
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== START SERVER =====
app.listen(PORT, async () => {
  console.log('Trading bot running on port ' + PORT);
  await initMetaApi();
});
