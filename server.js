const express = require('express');
const MetaApi = require('metaapi.cloud-sdk').default;
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===== API KEYS — PERSISTENT STORAGE =====
// Primary: /var/data (persistent disk on paid Render plans)
// Fallback: /tmp (ephemeral — wiped on free tier redeploys)
const PERSIST_DIR = (() => {
  // Check if /var/data is writable (paid tier with disk)
  try { fs.mkdirSync('/var/data', { recursive: true }); return '/var/data'; } catch(e) {}
  return '/tmp';
})();

const API_KEYS_FILE = path.join(PERSIST_DIR, 'api-keys.json');
const API_KEY_PREFIX = 'mtrd_';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null; // Set in Render env vars

function loadApiKeys() {
  try {
    if (fs.existsSync(API_KEYS_FILE)) {
      return JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
    }
  } catch(e) { console.log('loadApiKeys error:', e.message); }
  return [];
}

function saveApiKeys(keys) {
  try {
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(keys, null, 2));
  } catch(e) { console.log('saveApiKeys error:', e.message); }
}

function generateApiKey() {
  return API_KEY_PREFIX + crypto.randomBytes(24).toString('hex');
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Middleware: validate API key for /api/ key-protected routes
function requireApiKey(req, res, next) {
  const auth = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!auth) {
    return res.status(401).json({ error: 'Missing API key. Provide X-API-KEY header.' });
  }
  const keys = loadApiKeys();
  const hashed = hashKey(auth);
  const keyRecord = keys.find(k => k.hash === hashed && k.active);
  if (!keyRecord) {
    return res.status(401).json({ error: 'Invalid or inactive API key.' });
  }
  req.apiKeyId = keyRecord.id;
  req.apiKeyLabel = keyRecord.label;
  next();
}

// Middleware: require admin password for key management (protects /api/keys)
// Must pass X-Admin-Password header
function requireAdmin(req, res, next) {
  // If no ADMIN_PASSWORD set, block all key management for security
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({
      error: 'Key management disabled. Set ADMIN_PASSWORD env var on Render to enable.',
      hint: 'Go to Render dashboard → Environment → Add ADMIN_PASSWORD'
    });
  }
  const adminPw = req.headers['x-admin-password'];
  if (!adminPw || adminPw !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password.' });
  }
  next();
}

// ===== METAAPI STATE =====
let metaApi = null;
let account = null;
let connection = null;
let runtimeToken = null;
let runtimeAccountId = null;
let runtimeJournalPath = null;
let connected = false;

let brokerSymbols = [];
let symbolMap = {};

// ===== SYMBOL RESOLUTION =====
async function fetchBrokerSymbols() {
  if (!connection) return [];
  try {
    const symbols = await connection.getSymbols();
    brokerSymbols = symbols.map(s => s.symbol || s);
    const generics = ['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','XAUUSD','BTCUSD','US30','NAS100','SPX500'];
    symbolMap = {};
    for (const g of generics) {
      const exact = brokerSymbols.find(s => s === g);
      if (exact) { symbolMap[g] = exact; continue; }
      const match = brokerSymbols.find(s => s.toUpperCase().startsWith(g.toUpperCase()) || s.toUpperCase().includes(g.toUpperCase()));
      if (match) symbolMap[g] = match;
    }
    console.log('Symbol map built:', symbolMap);
    return brokerSymbols;
  } catch(e) { console.log('fetchBrokerSymbols error:', e.message); return []; }
}

function resolveSymbol(sym) {
  if (!sym) return sym;
  if (brokerSymbols.includes(sym)) return sym;
  if (symbolMap[sym.toUpperCase()]) return symbolMap[sym.toUpperCase()];
  const upper = sym.toUpperCase();
  const match = brokerSymbols.find(s => s.toUpperCase().startsWith(upper) || s.toUpperCase().includes(upper));
  return match || sym;
}

// In-memory journal
let journalEntries = [];
const JOURNAL_FILE = process.env.JOURNAL_FILE || path.join(PERSIST_DIR, 'trades-journal.json');

// ===== JOURNAL PERSISTENCE =====
function loadJournal() {
  if (fs.existsSync(JOURNAL_FILE)) {
    try {
      journalEntries = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf8'));
      console.log('Journal loaded:', journalEntries.length, 'entries');
    } catch(e) {
      console.log('Could not load journal:', e.message);
    }
  }
}

function saveJournal() {
  if (!runtimeJournalPath) return;
  try {
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(journalEntries, null, 2));
  } catch(e) {
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
  if (connection) {
    try { await connection.close(); } catch(e) {}
    connection = null; account = null; metaApi = null;
    connected = false;
  }
  try {
    metaApi = new MetaApi(token);
    account = await metaApi.metatraderAccountApi.getAccount(accountId);
    if (account.state !== 'DEPLOYED') {
      await account.deploy();
    }
    await account.waitConnected();
    connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    runtimeToken = token;
    runtimeAccountId = accountId;
    connected = true;
        await fetchBrokerSymbols();
    console.log('MetaApi connected!');
    return { success: true, server: account.server || 'connected' };
  } catch(err) {
    connected = false;
    return { error: err.message };
  }
}

// ===== ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API KEY MANAGEMENT (requires X-Admin-Password header)
// ===== ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// List all API keys (masked — never shows the actual key after creation)
app.get('/api/keys', requireAdmin, (req, res) => {
  const keys = loadApiKeys();
  res.json(keys.map(k => ({
    id: k.id,
    label: k.label,
    key: k.key,           // Only returned on creation! After that, gone forever.
    prefix: API_KEY_PREFIX + k.key.substring(API_KEY_PREFIX.length, k.key.length - 4) + '****',
    createdAt: k.createdAt,
    lastUsed: k.lastUsed,
    active: k.active,
    permissions: k.permissions,
    note: 'Save the key now — it will not be shown again.'
  })));
});

// Create new API key
app.post('/api/keys', requireAdmin, (req, res) => {
  const { label, permissions } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });

  const keys = loadApiKeys();
  const rawKey = generateApiKey();
  const record = {
    id: Date.now().toString(36),
    label: label.trim(),
    key: rawKey,
    hash: hashKey(rawKey),
    permissions: permissions || ['read'],
    active: true,
    createdAt: new Date().toISOString(),
    lastUsed: null
  };
  keys.push(record);
  saveApiKeys(keys);
  logApiEvent('key_created', record.id, `API key created: ${label}`);

  res.status(201).json({
    id: record.id,
    label: record.label,
    key: rawKey,  // Only returned ONCE at creation
    prefix: record.key.substring(0, API_KEY_PREFIX.length + 8) + '...',
    createdAt: record.createdAt,
    permissions: record.permissions,
    active: true,
    note: '⚠️ Copy this key now — it will never be shown again!'
  });
});

// Update API key (label, active, permissions)
app.patch('/api/keys/:id', requireAdmin, (req, res) => {
  const keys = loadApiKeys();
  const idx = keys.findIndex(k => k.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Key not found' });

  const { label, active, permissions } = req.body;
  if (label !== undefined) keys[idx].label = label;
  if (active !== undefined) keys[idx].active = active;
  if (permissions !== undefined) keys[idx].permissions = permissions;
  saveApiKeys(keys);

  res.json({ success: true, id: keys[idx].id, label: keys[idx].label, active: keys[idx].active, permissions: keys[idx].permissions });
});

// Delete API key
app.delete('/api/keys/:id', requireAdmin, (req, res) => {
  const keys = loadApiKeys();
  const idx = keys.findIndex(k => k.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Key not found' });
  const deleted = keys.splice(idx, 1)[0];
  saveApiKeys(keys);
  logApiEvent('key_deleted', deleted.id, `API key deleted: ${deleted.label}`);
  res.json({ success: true, deleted: deleted.label });
});

// Revoke all keys (emergency)
app.delete('/api/keys', requireAdmin, (req, res) => {
  const count = loadApiKeys().length;
  saveApiKeys([]);
  res.json({ success: true, revoked: count });
});

// ===== ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OPENAPI / SWAGGER SPEC
// ===== ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'MetaApi Trading Bot — REST API',
    version: '1.0.0',
    description: `
## Overview
Connect your MetaApi MT5 trading account to any external app — trading bots, dashboards, alert systems, automation workflows.

## Authentication
All \`/api/*\` endpoints (except key management) require an API key:

\`\`\`
X-API-KEY: mtrd_a1b2c3d4e5f6...
\`\`\`

or

\`\`\`
Authorization: Bearer mtrd_a1b2c3d4e5f6...
\`\`\`

## Rate Limits
- Read endpoints: **60 req/min**
- Trade endpoints: **10 req/min**
- Key management: **10 req/min**

## Base URL
\`\`\`
https://your-app.onrender.com/api
\`\`\`
    `.trim()
  },
  servers: [{ url: '/api', description: 'Trading Bot API' }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Returns API status and connectivity state.',
        responses: { '200': { description: 'OK', content: { 'application/json': { example: { status: 'ok', connected: true, metaApiConfigured: true } } } } }
      }
    },
    '/account': {
      get: {
        summary: 'Get MT5 account info',
        description: 'Returns balance, equity, P&L, margin, leverage.',
        security: [{ ApiKeyAuth: [] }],
        responses: { '200': { description: 'Account info', content: { 'application/json': { example: { balance: 10000, equity: 10200, profit: 200, margin: 500, freeMargin: 9700, leverage: 100, server: 'ICMarketsSC-Demo' } } } } }
      }
    },
    '/positions': {
      get: {
        summary: 'List open positions',
        security: [{ ApiKeyAuth: [] }],
        responses: { '200': { description: 'Array of open positions', content: { 'application/json': { example: [{ id: 'pos_123', symbol: 'EURUSD', type: 'buy', volume: 0.1, profit: 15.50 }] } } } }
      }
    },
    '/orders': {
      get: {
        summary: 'List pending orders',
        security: [{ ApiKeyAuth: [] }],
        responses: { '200': { description: 'Array of pending orders', content: { 'application/json': { example: [{ id: 'ord_456', symbol: 'XAUUSD', type: 'sell limit', volume: 0.01, price: 1900 }] } } } }
      }
    },
    '/history': {
      get: {
        summary: 'Get recent deals (last 7 days)',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', default: 7 }, description: 'Number of days to look back' }
        ],
        responses: { '200': { description: 'Array of completed deals', content: { 'application/json': { example: [{ id: 'dl_789', symbol: 'EURUSD', type: 'sell', volume: 0.05, profit: -3.20, closeTime: '2026-03-26T12:00:00Z' }] } } } }
      }
    },
    '/price/{symbol}': {
      get: {
        summary: 'Get live price for a symbol',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'symbol', in: 'path', required: true, schema: { type: 'string' }, example: 'EURUSD', description: 'MT5 symbol (EURUSD, XAUUSD, US30, etc.)' }
        ],
        responses: { '200': { description: 'Symbol price data', content: { 'application/json': { example: { symbol: 'EURUSD', bid: 1.08420, ask: 1.08425, spread: 0.5 } } } } }
      }
    },
    '/trade': {
      post: {
        summary: 'Execute a market order',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: { symbol: 'EURUSD', type: 'buy', volume: 0.01, stopLoss: 1.08200, takeProfit: 1.08600 },
              schema: {
                type: 'object',
                required: ['symbol', 'type', 'volume'],
                properties: {
                  symbol: { type: 'string', example: 'EURUSD', description: 'MT5 symbol' },
                  type: { type: 'string', enum: ['buy', 'sell'], example: 'buy' },
                  volume: { type: 'number', example: 0.01, description: 'Lots (min 0.01)' },
                  stopLoss: { type: 'number', example: 1.08200, description: 'Optional SL price' },
                  takeProfit: { type: 'number', example: 1.08600, description: 'Optional TP price' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Order executed', content: { 'application/json': { example: { orderId: 'ord_123', positionId: 'pos_456', stringCode: 'TRADE', done: true } } } },
          '400': { description: 'Invalid parameters' },
          '429': { description: 'Rate limit exceeded' }
        }
      }
    },
    '/close/{positionId}': {
      post: {
        summary: 'Close an open position',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'positionId', in: 'path', required: true, schema: { type: 'string' }, example: 'pos_123456' }
        ],
        responses: { '200': { description: 'Position closed', content: { 'application/json': { example: { done: true, orderId: 'ord_789' } } } } }
      }
    },
    '/close-all': {
      post: {
        summary: 'Close ALL open positions',
        security: [{ ApiKeyAuth: [] }],
        responses: { '200': { description: 'All positions closed', content: { 'application/json': { example: { closed: 3, results: [] } } } } }
      }
    },
    '/journal': {
      get: {
        summary: 'List trade journal entries',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Max entries to return' }
        ],
        responses: { '200': { description: 'Array of journal entries', content: { 'application/json': { example: [{ id: 1711500000000, symbol: 'EURUSD', type: 'buy', volume: 0.01, pnl: 12.50, setup: 'Breakout', tags: ['scalp'] }] } } } }
      }
    },
    '/journal': {
      post: {
        summary: 'Add a journal entry',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: { symbol: 'XAUUSD', type: 'buy', volume: 0.1, pnl: 25.00, setup: 'Trend continuation', tags: ['swing', 'gold'], notes: 'Fed news catalyst' },
              schema: {
                type: 'object',
                properties: {
                  symbol: { type: 'string' },
                  type: { type: 'string' },
                  volume: { type: 'number' },
                  pnl: { type: 'number' },
                  setup: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  notes: { type: 'string' },
                  emotion: { type: 'string' },
                  screenshot: { type: 'string', description: 'URL to screenshot' }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Entry created' } }
      }
    },
    '/journal/stats': {
      get: {
        summary: 'Get journal statistics',
        security: [{ ApiKeyAuth: [] }],
        responses: { '200': { description: 'Stats object', content: { 'application/json': { example: { total: 47, wins: 31, losses: 16, winRate: '66.0', totalPnl: '284.50', avgPnl: '6.05' } } } } }
      }
    }
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-KEY',
        description: 'Your API key from the dashboard → Settings → API Keys'
      }
    }
  }
};

app.get('/api/docs.json', (req, res) => {
  res.json(SPEC);
});

app.get('/api/docs', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>MetaApi Trading Bot — API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, sans-serif; background:#0f172a; color:#e2e8f0; padding:20px; }
    .container { max-width:900px; margin:0 auto; }
    h1 { color:#38bdf8; font-size:32px; margin-bottom:8px; }
    .subtitle { color:#64748b; margin-bottom:30px; font-size:14px; }
    h2 { color:#38bdf8; font-size:20px; margin:30px 0 16px; border-bottom:1px solid #334155; padding-bottom:8px; }
    h3 { color:#f1f5f9; font-size:16px; margin:20px 0 10px; }
    code { background:#1e293b; padding:2px 6px; border-radius:4px; font-size:13px; color:#7dd3fc; }
    pre { background:#1e293b; padding:16px; border-radius:10px; overflow-x:auto; margin:10px 0; border:1px solid #334155; }
    pre code { background:none; padding:0; color:#e2e8f0; font-size:13px; }
    .endpoint { background:#1e293b; border-radius:10px; padding:16px; margin:10px 0; border:1px solid #334155; }
    .method { display:inline-block; padding:3px 10px; border-radius:6px; font-size:12px; font-weight:bold; margin-right:8px; }
    .get { background:#065f46; color:#6ee7b7; }
    .post { background:#1e3a5f; color:#7dd3fc; }
    .patch { background:#92400e; color:#fde68a; }
    .delete { background:#7f1d1d; color:#fca5a5; }
    .path { font-family:monospace; font-size:15px; color:#e2e8f0; }
    .desc { color:#94a3b8; margin-top:8px; font-size:14px; }
    .auth-note { background:#1c1408; border:1px solid #92400e; border-radius:8px; padding:14px; color:#fbbf24; margin:16px 0; font-size:13px; line-height:1.7; }
    .toc { background:#1e293b; border-radius:10px; padding:20px; margin:20px 0; border:1px solid #334155; }
    .toc a { color:#38bdf8; text-decoration:none; display:block; padding:4px 0; font-size:14px; }
    .toc a:hover { text-decoration:underline; }
    .badge { background:#334155; color:#94a3b8; padding:2px 8px; border-radius:4px; font-size:11px; margin-left:6px; }
    .example-req { background:#0f172a; border-radius:6px; padding:12px; margin-top:10px; font-size:13px; }
  </style>
</head>
<body>
<div class="container">
  <h1>📊 MetaApi Trading Bot — API</h1>
  <p class="subtitle">Version 1.0.0 · Base URL: <code>/api</code></p>

  <div class="auth-note">
    <strong>🔑 Authentication</strong><br>
    Add your API key to every request header:<br>
    <code>X-API-KEY: mtrd_a1b2c3...</code><br><br>
    Get or create API keys at: <strong>Dashboard → Settings → API Keys</strong>
  </div>

  <div class="toc">
    <strong style="color:#94a3b8;font-size:13px;margin-bottom:10px;display:block">ENDPOINTS</strong>
    <a href="#health">GET /api/health</a>
    <a href="#account">GET /api/account</a>
    <a href="#positions">GET /api/positions</a>
    <a href="#orders">GET /api/orders</a>
    <a href="#history">GET /api/history</a>
    <a href="#price">GET /api/price/:symbol</a>
    <a href="#trade">POST /api/trade</a>
    <a href="#close">POST /api/close/:positionId</a>
    <a href="#close-all">POST /api/close-all</a>
    <a href="#journal-get">GET /api/journal</a>
    <a href="#journal-post">POST /api/journal</a>
    <a href="#journal-stats">GET /api/journal/stats</a>
    <a href="#spec">GET /api/docs.json</a>
  </div>

  <h2 id="health">Health Check</h2>
  <div class="endpoint">
    <span class="method get">GET</span><span class="path">/api/health</span>
    <p class="desc">Check if the API is online and whether MetaApi is connected.</p>
    <pre><code>curl -H "X-API-KEY: mtrd_yourkey" https://your-app.onrender.com/api/health</code></pre>
    <pre><code>{
  "status": "ok",
  "connected": true,
  "metaApiConfigured": true,
  "server": "ICMarketsSC-Demo"
}</code></pre>
  </div>

  <h2 id="account">Account Info</h2>
  <div class="endpoint">
    <span class="method get">GET</span><span class="path">/api/account</span>
    <p class="desc">Get MT5 account balance, equity, P&L, margin, leverage.</p>
    <pre><code>curl -H "X-API-KEY: mtrd_yourkey" https://your-app.onrender.com/api/account</code></pre>
    <pre><code>{
  "balance": 10000.00,
  "equity": 10250.75,
  "profit": 250.75,
  "margin": 500.00,
  "freeMargin": 9750.75,
  "leverage": 100,
  "server": "ICMarketsSC-Demo"
}</code></pre>
  </div>

  <h2 id="positions">Open Positions</h2>
  <div class="endpoint">
    <span class="method get">GET</span><span class="path">/api/positions</span>
    <p class="desc">List all currently open positions.</p>
    <pre><code>curl -H "X-API-KEY: mtrd_yourkey" https://your-app.onrender.com/api/positions</code></pre>
    <pre><code>[
  {
    "id": "py_z4b8ck9v2n",
    "symbol": "EURUSD",
    "type": "buy",
    "volume": 0.10,
    "openPrice": 1.08320,
    "currentPrice": 1.08450,
    "profit": 13.00,
    "swap": 0.00,
    "commission": -2.20
  }
]</code></pre>
  </div>

  <h2 id="orders">Pending Orders</h2>
  <div class="endpoint">
    <span class="method get">GET</span><span class="path">/api/orders</span>
    <p class="desc">List all pending (limit/stop) orders.</p>
    <pre><code>curl -H "X-API-KEY: mtrd_yourkey" https://your-app.onrender.com/api/orders</code></pre>
  </div>

  <h2 id="history">Deal History</h2>
  <div class="endpoint">
    <span class="method get">GET</span><span class="path">/api/history?days=7</span>
    <p class="desc">Get completed deals from the last N days (default: 7). Query param: <code>days</code></p>
    <pre><code>curl -H "X-API-KEY: mtrd_yourkey" https://your-app.onrender.com/api/history?days=30</code></pre>
    <pre><code>[
  {
    "id": "dl_abc123",
    "symbol": "XAUUSD",
    "type": "sell",
    "volume": 0.10,
    "openPrice": 1910.50,
    "closePrice": 1905.20,
    "profit": 53.00,
    "closeTime": "2026-03-25T18:30:00.000Z"
  }
]</code></pre>
  </div>

  <h2 id="price">Live Price</h2>
  <div class="endpoint">
    <span class="method get">GET</span><span class="path">/api/price/:symbol</span>
    <p class="desc">Get real-time bid/ask for any symbol. Supported: EURUSD, GBPUSD, USDJPY, XAUUSD, GOLD, BTCUSD, US30, NAS100, SPX500, AUDUSD, USDCAD</p>
    <pre><code>curl -H "X-API-KEY: mtrd_yourkey" https://your-app.onrender.com/api/price/XAUUSD</code></pre>
    <pre><code>{
  "symbol": "XAUUSD",
  "bid": 1915.80,
  "ask": 1916.00,
  "spread": 0.20,
  "timestamp": 1711500000000
}</code></pre>
  </div>

  <h2 id="trade">Place Trade</h2>
  <div class="endpoint">
    <span class="method post">POST</span><span class="path">/api/trade</span>
    <p class="desc">Execute a market buy or sell order.</p>
    <div class="example-req">
      <strong style="color:#94a3b8;font-size:12px">REQUEST BODY</strong>
      <pre><code>{
  "symbol": "EURUSD",
  "type": "buy",          // "buy" or "sell"
  "volume": 0.01,         // lots (min 0.01)
  "stopLoss": 1.08200,    // optional
  "takeProfit": 1.08600   // optional
}</code></pre>
    </div>
    <pre><code>curl -X POST -H "Content-Type: application/json" \\
     -H "X-API-KEY: mtrd_yourkey" \\
     -d '{"symbol":"EURUSD","type":"buy","volume":0.01}' \\
     https://your-app.onrender.com/api/trade</code></pre>
    <pre><code>{
  "orderId": "ord_12345",
  "positionId": "pos_67890",
  "stringCode": "TRADE",
  "done": true
}</code></pre>
  </div>

  <h2 id="close">Close Position</h2>
  <div class="endpoint">
    <span class="method post">POST</span><span class="path">/api/close/:positionId</span>
    <p class="desc">Close a specific open position by its ID.</p>
    <pre><code>curl -X POST -H "X-API-KEY: mtrd_yourkey" \\
     https://your-app.onrender.com/api/close/pos_67890</code></pre>
    <pre><code>{ "done": true, "orderId": "ord_54321" }</code></pre>
  </div>

  <h2 id="close-all">Close All Positions</h2>
  <div class="endpoint">
    <span class="method post">POST</span><span class="path">/api/close-all</span>
    <p class="desc">Market-close every open position on the account.</p>
    <pre><code>curl -X POST -H "X-API-KEY: mtrd_yourkey" \\
     https://your-app.onrender.com/api/close-all</code></pre>
    <pre><code>{ "closed": 3, "results": [...] }</code></pre>
  </div>

  <h2 id="journal-get">Get Journal</h2>
  <div class="endpoint">
    <span class="method get">GET</span><span class="path">/api/journal?limit=50</span>
    <p class="desc">Retrieve trade journal entries. Add limit param to control count.</p>
    <pre><code>curl -H "X-API-KEY: mtrd_yourkey" https://your-app.onrender.com/api/journal?limit=20</code></pre>
    <pre><code>[
  {
    "id": 1711500000000,
    "symbol": "EURUSD",
    "type": "buy",
    "volume": 0.01,
    "pnl": 12.50,
    "setup": "Breakout at key level",
    "tags": ["scalp", "EUR"],
    "notes": "Good risk:reward",
    "date": "2026-03-26T14:00:00.000Z"
  }
]</code></pre>
  </div>

  <h2 id="journal-post">Add Journal Entry</h2>
  <div class="endpoint">
    <span class="method post">POST</span><span class="path">/api/journal</span>
    <p class="desc">Manually log a trade or note to the journal.</p>
    <pre><code>curl -X POST -H "Content-Type: application/json" \\
     -H "X-API-KEY: mtrd_yourkey" \\
     -d '{"symbol":"XAUUSD","type":"buy","volume":0.1,"pnl":25,"setup":"Trend continuation","tags":["swing","gold"]}' \\
     https://your-app.onrender.com/api/journal</code></pre>
    <pre><code>{ "id": 1711500000000, "success": true }</code></pre>
  </div>

  <h2 id="journal-stats">Journal Stats</h2>
  <div class="endpoint">
    <span class="method get">GET</span><span class="path">/api/journal/stats</span>
    <p class="desc">Win rate, total P&L, avg P&L across all journal entries.</p>
    <pre><code>curl -H "X-API-KEY: mtrd_yourkey" https://your-app.onrender.com/api/journal/stats</code></pre>
    <pre><code>{
  "total": 47,
  "wins": 31,
  "losses": 16,
  "winRate": "66.0",
  "totalPnl": "284.50",
  "avgPnl": "6.05"
}</code></pre>
  </div>

  <h2 id="spec">OpenAPI Spec</h2>
  <div class="endpoint">
    <span class="method get">GET</span><span class="path">/api/docs.json</span>
    <p class="desc">Full OpenAPI 3.0 spec in JSON format — import into Postman, Insomnia, Swagger UI, etc.</p>
    <pre><code>curl https://your-app.onrender.com/api/docs.json</code></pre>
  </div>

  <h2>📋 API Key Management</h2>
  <div class="endpoint">
    <span class="method get">GET</span><span class="path">/api/keys</span>
    <p class="desc">List all API keys (shows prefix only, not full key after creation).</p>
  </div>
  <div class="endpoint">
    <span class="method post">POST</span><span class="path">/api/keys</span>
    <p class="desc">Create a new API key. Returns the full key ONCE — store it immediately.</p>
    <pre><code>curl -X POST -H "Content-Type: application/json" \\
     -d '{"label":"Zapier Integration","permissions":["read","trade","journal"]}' \\
     https://your-app.onrender.com/api/keys</code></pre>
    <pre><code>{
  "id": "m1abc",
  "label": "Zapier Integration",
  "key": "mtrd_a1b2c3d4e5f6...",
  "note": "⚠️ Copy this key now — it will never be shown again!"
}</code></pre>
  </div>
  <div class="endpoint">
    <span class="method patch">PATCH</span><span class="path">/api/keys/:id</span>
    <p class="desc">Update key label, active status, or permissions.</p>
    <pre><code>curl -X PATCH -H "Content-Type: application/json" \\
     -d '{"active":false}' \\
     https://your-app.onrender.com/api/keys/m1abc</code></pre>
  </div>
  <div class="endpoint">
    <span class="method delete">DELETE</span><span class="path">/api/keys/:id</span>
    <p class="desc">Permanently delete an API key.</p>
    <pre><code>curl -X DELETE https://your-app.onrender.com/api/keys/m1abc</code></pre>
  </div>

  <br><br><br>
</div>
</body>
</html>`);
});

// ===== ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROTECTED ROUTES (require API key)
// ===== ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get('/api/health', requireApiKey, (req, res) => {
  res.json({
    status: 'ok',
    connected,
    metaApiConfigured: !!(runtimeToken && runtimeAccountId),
    server: account?.server || null,
    keyLabel: req.apiKeyLabel
  });
});

app.get('/api/account', requireApiKey, async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected to MetaApi. Open dashboard Settings.' });
  try {
    const info = await connection.getAccountInformation();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/positions', requireApiKey, async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try { res.json(await connection.getPositions()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders', requireApiKey, async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try { res.json(await connection.getOrders()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/history', requireApiKey, async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try {
    const days = parseInt(req.query.days) || 7;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const end = new Date();
    res.json(await connection.getDealsByTimeRange(start, end));
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/symbols', async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try {
    if (brokerSymbols.length === 0) await fetchBrokerSymbols();
    res.json({ symbols: brokerSymbols, map: symbolMap });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/price/:symbol', requireApiKey, async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try {
    const resolved = resolveSymbol(req.params.symbol);
    const tick = await connection.getSymbolPrice(resolved);
    res.json({
      symbol: req.params.symbol,
      bid: tick.bid,
      ask: tick.ask,
      spread: tick.ask && tick.bid ? ((tick.ask - tick.bid) * 100000).toFixed(1) : null,
      timestamp: tick.time || Date.now()
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/trade', requireApiKey, async (req, res) => {
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
    if (type === 'buy') result = await connection.createMarketBuyOrder(resolveSymbol(symbol), vol, sl, tp);
    else if (type === 'sell') result = await connection.createMarketSellOrder(resolveSymbol(symbol), vol, sl, tp);
    else return res.status(400).json({ error: 'Type must be buy or sell' });

    // Auto-journal
    journalEntries.push({
      id: Date.now(),
      date: new Date().toISOString(),
      symbol, type, volume: vol,
      result: result.stringCode || 'executed',
      pnl: 0,
      notes: 'Auto-logged via API',
      tags: ['api'],
      orderId: result.orderId || null,
      positionId: result.positionId || null
    });
    saveJournal();
    logApiEvent('trade_executed', req.apiKeyId, `${type.toUpperCase()} ${vol} ${symbol} via API key: ${req.apiKeyLabel}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/close/:positionId', requireApiKey, async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try { res.json(await connection.closePosition(req.params.positionId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/close-all', requireApiKey, async (req, res) => {
  if (!connected) return res.status(503).json({ error: 'Not connected' });
  try {
    const positions = await connection.getPositions();
    const results = [];
    for (const pos of positions) {
      try { results.push({ id: pos.id, result: await connection.closePosition(pos.id) }); }
      catch(e) { results.push({ id: pos.id, error: e.message }); }
    }
    res.json({ closed: results.filter(r => r.result).length, results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== JOURNAL (protected) =====
app.get('/api/journal', requireApiKey, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(journalEntries.slice(-limit).reverse());
});

app.post('/api/journal', requireApiKey, (req, res) => {
  const { date, symbol, type, volume, pnl, notes, tags, emotion, setup, screenshot } = req.body;
  const entry = {
    id: Date.now(),
    date: date || new Date().toISOString(),
    symbol: symbol || '', type: type || '',
    volume: parseFloat(volume) || 0,
    pnl: parseFloat(pnl) || 0,
    notes: notes || '', tags: tags || [],
    emotion: emotion || '', setup: setup || '',
    screenshot: screenshot || ''
  };
  journalEntries.push(entry);
  saveJournal();
  logApiEvent('journal_entry', req.apiKeyId, `Journal entry added: ${symbol} ${type} $${entry.pnl}`);
  res.status(201).json(entry);
});

app.put('/api/journal/:id', requireApiKey, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = journalEntries.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
  journalEntries[idx] = { ...journalEntries[idx], ...req.body, id };
  saveJournal();
  res.json(journalEntries[idx]);
});

app.delete('/api/journal/:id', requireApiKey, (req, res) => {
  const id = parseInt(req.params.id);
  journalEntries = journalEntries.filter(e => e.id !== id);
  saveJournal();
  res.json({ deleted: true });
});

app.get('/api/journal/stats', requireApiKey, (req, res) => {
  const total = journalEntries.length;
  const wins = journalEntries.filter(e => e.pnl > 0).length;
  const losses = journalEntries.filter(e => e.pnl < 0).length;
  const totalPnl = journalEntries.reduce((s, e) => s + (e.pnl || 0), 0);
  res.json({ total, wins, losses, winRate: total > 0 ? ((wins/total)*100).toFixed(1) : 0, totalPnl: totalPnl.toFixed(2), avgPnl: (total > 0 ? totalPnl/total : 0).toFixed(2) });
});

// ===== INIT ENDPOINT (from UI) =====
app.post('/api/init', async (req, res) => {
  const { token, accountId, journalPath } = req.body;
  if (!token || !accountId) return res.status(400).json({ error: 'token and accountId required' });
  initJournalPath(journalPath);
  const result = await initMetaApi(token, accountId);
  res.json(result);
});

app.get('/api/config-status', requireApiKey, (req, res) => {
  res.json({
    configured: !!(runtimeToken && runtimeAccountId),
    connected,
    accountId: runtimeAccountId ? (runtimeAccountId.substring(0, 8) + '...') : null,
    journalPath: runtimeJournalPath || null,
    journalEntries: journalEntries.length
  });
});

// ===== EVENT LOG =====
const EVENT_LOG_FILE = path.join(PERSIST_DIR, 'api-events.log');
function logApiEvent(event, keyId, message) {
  const line = `[${new Date().toISOString()}] [${event}] [key:${keyId}] ${message}\n`;
  fs.appendFile(EVENT_LOG_FILE, line, () => {});
  console.log(line.trim());
}

// ===== SERVE DASHBOARD =====
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== AUTO-INIT FROM ENV =====
app.listen(PORT, async () => {
  console.log('Trading bot running on port ' + PORT);
    // Seed default dashboard API key from env var
  const defaultKey = process.env.DEFAULT_API_KEY;
  if (defaultKey) {
    const keys = loadApiKeys();
    const hashed = hashKey(defaultKey);
    if (!keys.find(k => k.hash === hashed)) {
      keys.push({ id: 'default', label: 'Dashboard (auto)', key: defaultKey, hash: hashed, permissions: ['read','trade','journal'], active: true, createdAt: new Date().toISOString(), lastUsed: null });
      saveApiKeys(keys);
      console.log('Default API key seeded from env.');
    }
  }
  const envToken = process.env.META_API_TOKEN;
  const envAccountId = process.env.META_API_ACCOUNT_ID;
  const envJournalPath = process.env.JOURNAL_FILE;
  if (envToken && envAccountId) {
    console.log('Connecting with env vars...');
    initJournalPath(envJournalPath);
    await initMetaApi(envToken, envAccountId);
  } else {
    console.log('No env vars — use Settings to configure API keys.');
  }
});
