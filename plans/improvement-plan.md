# MetaApi Trading Bot — Improvement Plan

## Overview
Recommendations to enhance the trading bot's reliability, security, UX, and functionality.

---

## Implementation Status

### ✅ Completed
- **Rate Limiting** — Added `express-rate-limit` with different limits for read (60/min), trade (10/min), and key management (10/min)
- **Public Health Check** — Added unauthenticated `/api/health` endpoint with uptime and connection status
- **WebSocket Server** — Initial WebSocket infrastructure with broadcast functions for prices and positions
- **Trade Confirmation** — Added confirmation dialog before executing trades and closing positions
- **Pending Orders** — Added `POST /api/order` endpoint for limit/stop orders and `DELETE /api/order/:id` to cancel
- **Price Charts** — Added TradingView Lightweight Charts with candlestick display
- **Candle Data Endpoint** — Added `GET /api/candles/:symbol` for chart data
- **Auto SL/TP** — Auto-calculate SL/TP based on current price with pip distance setting
- **Pending Orders UI** — Added form to create and manage pending orders (buylimit, selllimit, buystop, sellstop)

### 🚧 In Progress
- Testing infrastructure

### 📋 TODO
- Reconnection logic (auto-reconnect on MetaApi disconnect)
- Input validation (Joi/Zod)
- Multiple accounts support
- Journal analytics
- Structured logging (Winston/Pino)
- SQLite for journal (vs JSON file)
- Webhook notifications
- WebSocket frontend integration (connect chart to live prices)

---

## 1. Security Enhancements

### 1.1 Rate Limiting ✅
**Status**: Implemented
- Read endpoints: 60 requests/minute
- Trade endpoints: 10 requests/minute  
- Key management: 10 requests/minute

### 1.2 Input Validation
**Status**: TODO
**Recommendation**: Use `joi` or `zod` for schema validation
```javascript
const tradeSchema = {
  symbol: Joi.string().required().max(10),
  type: Joi.string().valid('buy', 'sell').required(),
  volume: Joi.number().min(0.01).max(50).required(),
  stopLoss: Joi.number().optional(),
  takeProfit: Joi.number().optional()
};
```

### 1.3 API Key Permissions
**Status**: TODO
**Current**: All keys have same permissions
**Recommendation**: Implement granular permissions (read, trade, journal, admin)

---

## 2. Reliability Improvements

### 2.1 Connection Health Monitoring
**Status**: TODO
**Recommendation**: Add heartbeat/reconnection logic
```javascript
// Periodic health check
setInterval(async () => {
  if (!connection) return;
  try {
    await connection.ping();
  } catch (e) {
    console.log('Connection lost, reconnecting...');
    await reconnectMetaApi();
  }
}, 30000); // Every 30 seconds
```

### 2.2 Trade Execution Safety
**Status**: TODO
**Recommendation**: Add pre-trade checks
- Margin check before placing order
- Symbol availability validation
- Price deviation alerts (if price moved significantly)
- Slippage estimation

### 2.3 Error Handling
**Status**: TODO
**Current**: Basic try/catch, returns raw error messages
**Recommendation**: Structured error responses
```javascript
catch (err) {
  logApiEvent('trade_failed', req.apiKeyId, err.message);
  res.status(500).json({
    error: 'TRADE_FAILED',
    message: err.message,
    code: err.code || 'UNKNOWN'
  });
}
```

---

## 3. Frontend Improvements

### 3.1 Real-time Updates (WebSocket)
**Status**: Infrastructure Ready
**Recommendation**: Connect frontend to WebSocket for live price updates

### 3.2 Trade Confirmation Modal ✅
**Status**: Implemented
**Recommendation**: Could enhance with a proper modal instead of `confirm()`

### 3.3 Price Charts
**Status**: TODO
**Recommendation**: Integrate lightweight charting (e.g., TradingView Lightweight Charts)
```javascript
import { createChart } from 'lightweight-charts';
const chart = createChart(container, { width: 600, height: 300 });
```

### 3.4 Mobile Optimization
**Status**: Basic responsive design in place
**Recommendation**: 
- Touch-friendly trade buttons
- Swipe gestures for position management
- Bottom navigation on mobile

---

## 4. Feature Additions

### 4.1 Pending Orders ✅
**Status**: Implemented
- `POST /api/order` — Create limit/stop orders (buylimit, selllimit, buystop, sellstop)
- `DELETE /api/order/:id` — Cancel pending order

### 4.2 Trade Alerts & Notifications
**Status**: TODO
**Recommendation**: 
- Price alerts (when symbol reaches X)
- Position P&L notifications
- Webhook integration for external alerts (Discord, Telegram)

### 4.3 Backtesting Integration
**Status**: TODO
**Recommendation**: Add historical data export for backtesting
```javascript
app.get('/api/export', async (req, res) => {
  const deals = await connection.getDealsByTimeRange(start, end);
  res.json(deals.map(d => ({
    time: d.closeTime,
    symbol: d.symbol,
    type: d.type,
    profit: d.profit,
    volume: d.volume
  })));
});
```

### 4.4 Multiple Accounts
**Status**: TODO
**Current**: Single MetaApi account
**Recommendation**: Support multiple trading accounts with account switching

### 4.5 Journal Tags & Analysis
**Status**: TODO
**Recommendation**: 
- Tag frequency analysis
- Best/worst symbols
- Win rate by symbol, time of day, day of week
- Setup effectiveness tracking

---

## 5. Performance Optimizations

### 5.1 Caching
**Status**: TODO
**Recommendation**: Cache symbol prices and account info
```javascript
const priceCache = new Map();
const CACHE_TTL = 1000; // 1 second

function getCachedPrice(symbol) {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}
```

### 5.2 Database for Journal
**Current**: JSON file storage
**Recommendation**: SQLite for better query performance as journal grows

### 5.3 Lazy Loading
**Current**: Load all data at once
**Recommendation**: Paginate journal and history endpoints

---

## 6. DevOps Improvements

### 6.1 Health Checks ✅
**Status**: Implemented
Unauthenticated `/api/health` returns uptime, connection status, server info

### 6.2 Logging
**Status**: TODO
**Current**: Console.log + file logging
**Recommendation**: Structured logging with Winston or Pino
```javascript
const logger = pino({ level: 'info' });
logger.info({ event: 'trade_executed', symbol, type, volume });
```

### 6.3 Environment Validation
**Status**: TODO
**Recommendation**: Fail fast on missing required env vars
```javascript
const required = ['META_API_TOKEN', 'META_API_ACCOUNT_ID'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}
```

---

## 7. Testing

### 7.1 Unit Tests
**Status**: TODO
**Recommendation**: Add tests for:
- Symbol resolution logic
- API key hashing
- Journal statistics calculation
- Trade validation

### 7.2 API Integration Tests
**Status**: TODO
**Recommendation**: Use Supertest
```javascript
const request = require('supertest');
test('POST /api/trade requires valid API key', async () => {
  const res = await request(app)
    .post('/api/trade')
    .send({ symbol: 'EURUSD', type: 'buy', volume: 0.01 });
  expect(res.status).toBe(401);
});
```

---

## Priority Recommendations

| Priority | Feature | Status |
|----------|---------|--------|
| HIGH | Rate limiting | ✅ Done |
| HIGH | Trade confirmation modal | ✅ Done |
| HIGH | Reconnection logic | TODO |
| MEDIUM | WebSocket live updates | 🚧 Infrastructure ready |
| MEDIUM | Pending orders | ✅ Done |
| MEDIUM | Input validation (Joi) | TODO |
| LOW | Charts integration | TODO |
| LOW | Multiple accounts | TODO |

---

## Changes Made

### server.js
1. Added `express-rate-limit` and `ws` dependencies
2. Added rate limiters: readLimiter (60/min), tradeLimiter (10/min), keyLimiter (10/min)
3. Added public unauthenticated `/api/health` endpoint with uptime
4. Added WebSocket server with `broadcastPrice()` and `broadcastPositionUpdate()` functions
5. Added `POST /api/order` for pending orders (buylimit, selllimit, buystop, sellstop)
6. Added `DELETE /api/order/:id` to cancel pending orders

### public/index.html
1. Added trade confirmation dialog to `placeTrade()`
2. Added confirmation to `closePos()`

### package.json
1. Added `express-rate-limit: ^7.1.5`
2. Added `ws: ^8.16.0`