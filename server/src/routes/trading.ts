import { Router } from 'express';
import { v4 as uuid } from 'uuid';

const router = Router();

// Demo positions
const positions = [
  { id: '1', symbol: 'EURUSD', type: 'buy', volume: 0.01, openPrice: 1.0845, currentPrice: 1.0850, profit: 5.00, swap: 0, commission: -0.20, openTime: '2024-01-15T10:00:00Z' },
  { id: '2', symbol: 'XAUUSD', type: 'buy', volume: 0.1, openPrice: 2045.00, currentPrice: 2050.00, profit: 50.00, swap: 0, commission: -2.00, openTime: '2024-01-15T08:00:00Z' },
];

// Demo account
const account = {
  balance: 10000.00,
  equity: 10055.00,
  margin: 100.00,
  freeMargin: 9955.00,
  unrealizedPnl: 55.00,
};

router.get('/account', (req, res) => {
  res.json(account);
});

router.get('/positions', (req, res) => {
  res.json(positions);
});

router.post('/positions', (req, res) => {
  const { symbol, type, volume, stopLoss, takeProfit } = req.body;
  
  const position = {
    id: uuid(),
    symbol,
    type,
    volume,
    openPrice: 1.0850, // Would get from market data
    currentPrice: 1.0850,
    profit: 0,
    swap: 0,
    commission: -(volume * 2),
    openTime: new Date().toISOString(),
    stopLoss,
    takeProfit,
  };
  
  positions.push(position);
  res.json(position);
});

router.post('/positions/:id/close', (req, res) => {
  const { id } = req.params;
  const index = positions.findIndex(p => p.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Position not found' });
  }
  
  const position = positions.splice(index, 1)[0];
  res.json(position);
});

router.post('/close-all', (req, res) => {
  const closed = [...positions];
  positions.length = 0;
  res.json({ closed: closed.length });
});

router.get('/orders', (req, res) => {
  res.json([]);
});

router.post('/orders', (req, res) => {
  const { symbol, type, volume, price, stopLoss, takeProfit } = req.body;
  
  const order = {
    id: uuid(),
    symbol,
    type,
    volume,
    price,
    stopLoss,
    takeProfit,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  res.json(order);
});

router.delete('/orders/:id', (req, res) => {
  res.json({ success: true });
});

export { router as tradingRouter };
