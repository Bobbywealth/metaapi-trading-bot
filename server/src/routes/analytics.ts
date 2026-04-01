import { Router } from 'express';

const router = Router();

router.get('/performance', (req, res) => {
  res.json({
    winRate: 67.5,
    profitFactor: 1.85,
    sharpeRatio: 1.42,
    maxDrawdown: 12.3,
    totalTrades: 142,
    totalProfit: 4230,
    averageWin: 85,
    averageLoss: 42,
    largestWin: 450,
    largestLoss: -180,
    consecutiveWins: 8,
    consecutiveLosses: 3,
  });
});

router.get('/equity-curve', (req, res) => {
  const equityCurve = [];
  let equity = 10000;
  const now = Date.now();
  
  for (let i = 0; i < 365; i++) {
    const date = new Date(now - (365 - i) * 24 * 60 * 60 * 1000);
    const change = (Math.random() - 0.45) * 100;
    equity += change;
    
    equityCurve.push({
      date: date.toISOString().split('T')[0],
      equity: Math.round(equity * 100) / 100,
    });
  }
  
  res.json(equityCurve);
});

router.get('/monthly', (req, res) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const monthly = months.map(month => ({
    month,
    trades: Math.floor(Math.random() * 30) + 10,
    pnl: Math.round((Math.random() * 2000 - 500) * 100) / 100,
    winRate: Math.round(Math.random() * 30 + 50),
  }));
  
  res.json(monthly);
});

router.get('/by-symbol', (req, res) => {
  res.json([
    { symbol: 'EURUSD', trades: 45, winRate: 71, pnl: 1850 },
    { symbol: 'GBPUSD', trades: 32, winRate: 62, pnl: 720 },
    { symbol: 'XAUUSD', trades: 28, winRate: 75, pnl: 1340 },
    { symbol: 'BTCUSD', trades: 18, winRate: 55, pnl: 320 },
    { symbol: 'USDJPY', trades: 19, winRate: 68, pnl: 420 },
  ]);
});

router.get('/by-day', (req, res) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const byDay = days.map(day => ({
    day,
    trades: Math.floor(Math.random() * 20) + 5,
    winRate: Math.round(Math.random() * 30 + 50),
  }));
  
  res.json(byDay);
});

export { router as analyticsRouter };
