import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { authRouter } from './routes/auth';
import { marketRouter } from './routes/market';
import { tradingRouter } from './routes/trading';
import { strategiesRouter } from './routes/strategies';
import { newsRouter } from './routes/news';
import { journalRouter } from './routes/journal';
import { analyticsRouter } from './routes/analytics';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/market', marketRouter);
app.use('/api/trading', tradingRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/news', newsRouter);
app.use('/api/journal', journalRouter);
app.use('/api/analytics', analyticsRouter);

// WebSocket
const activeConnections = new Map<string, any>();

io.on('connection', (socket) => {
  const token = socket.handshake.auth.token;
  console.log('Client connected:', socket.id);
  
  activeConnections.set(socket.id, { token, socket });

  socket.on('subscribe', (data: { channel: string; symbol?: string }) => {
    socket.join(data.channel);
    if (data.symbol) {
      socket.join(`${data.channel}:${data.symbol}`);
    }
  });

  socket.on('unsubscribe', (data: { channel: string; symbol?: string }) => {
    socket.leave(data.channel);
    if (data.symbol) {
      socket.leave(`${data.channel}:${data.symbol}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    activeConnections.delete(socket.id);
  });
});

// Broadcast price updates every second
setInterval(() => {
  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
  const basePrices: Record<string, number> = {
    EURUSD: 1.0850,
    GBPUSD: 1.2650,
    USDJPY: 149.50,
    XAUUSD: 2050,
    BTCUSD: 43000,
  };

  symbols.forEach((symbol) => {
    const base = basePrices[symbol];
    const volatility = symbol === 'BTCUSD' ? 100 : 0.001;
    const change = ((Math.random() - 0.5) * volatility);
    const bid = base + change;
    const ask = bid + (symbol === 'BTCUSD' ? 10 : 0.0002);
    const spread = symbol === 'BTCUSD' ? 10 : (ask - bid) * 100000;

    io.to(`market:${symbol}`).emit('price', {
      symbol,
      bid: bid.toFixed(5),
      ask: ask.toFixed(5),
      spread: spread.toFixed(1),
      change: ((change / base) * 100).toFixed(2),
      timestamp: Date.now(),
    });
  });
}, 1000);

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };
