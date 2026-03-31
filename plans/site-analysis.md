# MetaApi Trading Bot — Site Analysis

## Overview
A **MetaApi MT5 Trading Bot** with a web dashboard for managing MetaTrader 5 trading accounts via the MetaApi.cloud SDK.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (SPA)                        │
│                  public/index.html                       │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐   │
│  │Dashboard │ Trading │ Journal │ History │ Settings │   │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API (fetch)
┌─────────────────────▼───────────────────────────────────┐
│                 Backend (Express.js)                     │
│                      server.js                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │            API Routes (/api/*)                    │   │
│  │  • Key Management  • Trading  • Journal          │   │
│  │  • Account Info    • Positions  • History         │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │           MetaApi SDK Integration                │   │
│  │  MetaApi → Account → RPCConnection → MT5          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Backend ([`server.js`](server.js))

### Key Features
1. **API Key Management** (lines 14-82)
   - Persistent storage in `/var/data` or `/tmp`
   - SHA-256 hashed keys
   - Admin password protection for key management

2. **MetaApi Integration** (lines 84-187)
   - Connects to MetaTrader 5 via MetaApi.cloud SDK
   - Automatic symbol resolution (maps generic symbols like EURUSD to broker-specific versions)
   - Journal persistence to file

3. **REST API Endpoints** (lines 759-948)
   - Protected routes requiring API key authentication
   - Trading operations, account info, position management
   - Journal with CRUD operations

4. **Auto-initialization** (lines 970-994)
   - Supports env vars: `META_API_TOKEN`, `META_API_ACCOUNT_ID`, `JOURNAL_FILE`
   - `DEFAULT_API_KEY` seeding

---

## Frontend ([`public/index.html`](public/index.html))

### Pages/Features
1. **Dashboard** — Account overview, KPIs, live prices, quick trade
2. **Trading** — Place trades, manage positions
3. **Journal** — Trade logging with tags, setup notes, P&L tracking
4. **History** — Deal history from MetaApi
5. **Settings** — API key management, MetaApi configuration

### Tech Stack
- Vanilla JS (no framework)
- CSS custom properties for theming
- Google Fonts (Inter, JetBrains Mono)
- Responsive design with mobile sidebar

---

## API Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | API Key |
| GET | `/api/account` | Account info (balance, equity) | API Key |
| GET | `/api/positions` | Open positions | API Key |
| GET | `/api/orders` | Pending orders | API Key |
| GET | `/api/history` | Deal history | API Key |
| GET | `/api/price/:symbol` | Live price | API Key |
| POST | `/api/trade` | Execute trade | API Key |
| POST | `/api/close/:positionId` | Close position | API Key |
| POST | `/api/close-all` | Close all positions | API Key |
| GET/POST | `/api/journal` | Journal entries | API Key |
| GET | `/api/journal/stats` | Journal statistics | API Key |
| GET | `/api/keys` | List API keys | Admin |
| POST | `/api/keys` | Create API key | Admin |
| PATCH | `/api/keys/:id` | Update API key | Admin |
| DELETE | `/api/keys/:id` | Delete API key | Admin |
| POST | `/api/init` | Initialize MetaApi | None |

---

## Data Flow

```
User Action → Frontend JS → REST API → MetaApi SDK → MT5 Broker
                ↑                                        │
                └──────────── Response ←─────────────────┘
```

### Trading Flow
1. User enters symbol, volume, SL/TP in dashboard
2. `placeTrade()` → `POST /api/trade`
3. Server resolves symbol → `connection.createMarketBuyOrder()`
4. Auto-logs to journal
5. Returns order/position ID

---

## Security Features
- API keys hashed with SHA-256 (never stored plain)
- Admin password required for key management
- API key middleware validates on every protected route
- Keys stored in persistent storage (paid tier) or tmp (free tier)

---

## Environment Variables
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 3000) |
| `ADMIN_PASSWORD` | Password for key management |
| `META_API_TOKEN` | MetaApi token (auto-connect) |
| `META_API_ACCOUNT_ID` | MetaApi account ID (auto-connect) |
| `JOURNAL_FILE` | Custom journal file path |
| `DEFAULT_API_KEY` | Pre-seeded API key |

---

## Dependencies
- `express` ^4.18.2 — Web framework
- `metaapi.cloud-sdk` ^27.0.2 — MetaTrader API
- `cors` ^2.8.5 — Cross-origin support
- `dotenv` ^16.3.1 — Environment variables