import { Router } from 'express';

const router = Router();

// In-memory price data
const prices: Record<string, { bid: number; ask: number; change: number }> = {
  EURUSD: { bid: 1.0850, ask: 1.0852, change: 0.12 },
  GBPUSD: { bid: 1.2650, ask: 1.2653, change: -0.08 },
  USDJPY: { bid: 149.50, ask: 149.52, change: 0.05 },
  XAUUSD: { bid: 2050.00, ask: 2050.50, change: 0.45 },
  BTCUSD: { bid: 43000.00, ask: 43010.00, change: 1.23 },
};

router.get('/prices', (req, res) => {
  res.json(prices);
});

router.get('/price/:symbol', (req, res) => {
  const { symbol } = req.params;
  const price = prices[symbol];
  
  if (!price) {
    return res.status(404).json({ error: 'Symbol not found' });
  }
  
  res.json(price);
});

router.get('/candles/:symbol', (req, res) => {
  const { symbol } = req.params;
  const timeframe = parseInt(req.query.timeframe as string) || 60;
  const count = parseInt(req.query.count as string) || 100;
  
  const basePrice = prices[symbol]?.bid || 1.0;
  const candles = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const time = now - (count - i) * timeframe * 1000;
    const volatility = symbol === 'BTCUSD' ? 100 : 0.001;
    const trend = Math.sin(i / 10) * 0.5;
    
    const open = basePrice + trend + (Math.random() - 0.5) * volatility;
    const close = open + (Math.random() - 0.5) * volatility * 2;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    
    candles.push({
      time: new Date(time).toISOString(),
      open: parseFloat(open.toFixed(5)),
      high: parseFloat(high.toFixed(5)),
      low: parseFloat(low.toFixed(5)),
      close: parseFloat(close.toFixed(5)),
      volume: Math.floor(Math.random() * 10000) + 1000,
    });
  }
  
  res.json(candles);
});

router.get('/symbols', (req, res) => {
  res.json([
    { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'forex', precision: 5 },
    { symbol: 'GBPUSD', name: 'British Pound / US Dollar', type: 'forex', precision: 5 },
    { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', type: 'forex', precision: 3 },
    { symbol: 'XAUUSD', name: 'Gold / US Dollar', type: 'commodity', precision: 2 },
    { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', type: 'crypto', precision: 2 },
  ]);
});

export { router as marketRouter };
