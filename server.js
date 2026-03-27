const express = require('express');
const MetaApi = require('metaapi.cloud-sdk').default;
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// MetaApi state — initialized from environment or runtime via /api/init
let metaApi = null;
let account = null;
let connection = null;
let runtimeToken = null;
let runtimeAccountId = null;
let runtimeJournalPath = null;
let connected = false;

// In-memory journal (optionally backed by file)
let journalEntries = [];
const JOURNAL_FILE = process.env.JOURNAL_FILE || '/tmp/trades-journal.json';

// ===== JOURNAL PERSISTENCE =====
function loadJournal() {
  if (fs.existsSync(JOURNAL_FILE)) {
    try {
      const data = fs.readFileSync(JOURNAL_FILE, 'utf8');
      journalEntries = JSON.parse(data);
      console.log('Journal loaded from', JOURNAL_FILE, ':', journalEntries.length, 'entries');
    } catch (e) {
      console.log('Could not load journal file:', e.message);
    }
  }
}

function saveJournal() {
  if (!runtimeJournalPath) return; // Only save if file path configured
  try {
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(journalEntries, null, 2));
  } catch (e) {
    console.log('Journal save error:', e.message);
  }
}

function initJournalPath(journalPath) {
  if (journalPath) {
    runtimeJournalPath = journalPath;
    loadJournal();
  }
}

// ===== INIT METAAPI =====
async function initMetaApi(token, accountId) {
  // Close existing connection if re-connecting
  if (connection) {
    try { await connection.close(); } catch(e) {}
    connection = null;
    account = null;
    metaApi = null;
    connected = false;
  }

  try {
    console.log('Initializing MetaApi...');
    metaApi = new MetaApi(token);
    account = await metaApi.metatraderAccountApi.getAccount(accountId);
    console.log('Account state:', account.state);

    if (account.state !== 'DEPLOYED') {
      console.log('Deploying account...');
      await account.deploy();
    }
    await account.waitConnected();
    connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    runtimeToken = token;
    runtimeAccountId = accountId;
    connected = true;
    console.log('MetaApi connected and synchronized!');
    return { success: true, server: account.server || 'connected' };
  } catch (err) {
    connected = false;
    console.error('MetaApi init error:', err.message);
    return { error: err.message };
  }
}

// ===== INIT ENDPOINT (called by frontend) =====
app.post('/api/init', async (req, res) => {
  const { token, accountId, journalPath } = req.body;
  if (!token || !accountId) {
    return res.status(400).json({ error: 'token and accountId required' });
  }
  initJournalPath(journalPath);
  const result = await initMetaApi(token, accountId);
  res.json(result);
});

// ===== CONFIG STATUS =====
app.get('/api/config-status', (req, res) => {
  res.json({
    configured: !!(runtimeToken && runtimeAccountId),
    connected,
    accountId: runtimeAccountId ? (runtimeAccountId.substring(0, 8) + '...') : null,
    journalPath: runtimeJournalPath || null,
    journalEntries: journalEntries.length
  });
});

// ===== TRADING API ROUTES =====
app.get('/api/account', async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected to MetaApi. Open Settings and enter your API keys.' });
  try {
    const info = await connection.getAccountInformation();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/positions', async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try {
    const positions = await connection.getPositions();
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try {
    const orders = await connection.getOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history', async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
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
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try {
    const tick = await connection.getSymbolPrice(req.params.symbol);
    res.json(tick);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trade', async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
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
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      symbol: symbol,
      type: type,
      volume: vol,
      result: result.stringCode || 'executed',
      pnl: 0,
      notes: 'Auto-logged trade',
      tags: ['auto'],
      orderId: result.orderId || null,
      positionId: result.positionId || null
    };
    journalEntries.push(entry);
    saveJournal();

    console.log('Trade result:', JSON.stringify(result));
    res.json(result);
  } catch (err) {
    console.error('Trade error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/close/:positionId', async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try {
    const result = await connection.closePosition(req.params.positionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/close-all', async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try {
    const positions = await connection.getPositions();
    const results = [];
    for (const pos of positions) {
      try {
        const r = await connection.closePosition(pos.id);
        results.push({ id: pos.id, success: true, result: r });
      } catch(e) {
        results.push({ id: pos.id, success: false, error: e.message });
      }
    }
    res.json({ closed: results.filter(r => r.success).length, results });
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
  saveJournal();
  res.json(entry);
});

app.put('/api/journal/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = journalEntries.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
  journalEntries[idx] = { ...journalEntries[idx], ...req.body, id: id };
  saveJournal();
  res.json(journalEntries[idx]);
});

app.delete('/api/journal/:id', (req, res) => {
  const id = parseInt(req.params.id);
  journalEntries = journalEntries.filter(e => e.id !== id);
  saveJournal();
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

// ===== AUTO-INIT FROM ENV (optional fallback) =====
app.listen(PORT, async () => {
  console.log('Trading bot running on port ' + PORT);

  // Try env vars first, otherwise let user configure via UI
  const envToken = process.env.META_API_TOKEN;
  const envAccountId = process.env.META_API_ACCOUNT_ID;
  const envJournalPath = process.env.JOURNAL_FILE;

  if (envToken && envAccountId) {
    console.log('MetaApi env vars detected — connecting...');
    initJournalPath(envJournalPath);
    await initMetaApi(envToken, envAccountId);
  } else {
    console.log('No env vars set — open the UI and use Settings to configure your API keys.');
  }
});
