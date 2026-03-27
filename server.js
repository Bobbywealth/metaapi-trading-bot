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
