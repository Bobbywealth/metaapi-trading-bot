import { Router } from 'express';
import { v4 as uuid } from 'uuid';

const router = Router();

const strategies = [
  { id: '1', name: 'Trend Follower', description: 'Follows market trends using EMA crossover', type: 'trend', enabled: true, indicators: [], conditions: [], riskManagement: { stopLoss: 50, takeProfit: 100, maxPositions: 3, maxDrawdown: 10, riskPerTrade: 2 }, performance: { totalTrades: 142, winRate: 68, profitFactor: 1.85, sharpeRatio: 1.42, maxDrawdown: 12.3, totalProfit: 4230, averageWin: 85, averageLoss: 42 } },
  { id: '2', name: 'Mean Reversion', description: 'Trades based on price deviations from average', type: 'mean_reversion', enabled: false, indicators: [], conditions: [], riskManagement: { stopLoss: 30, takeProfit: 60, maxPositions: 5, maxDrawdown: 15, riskPerTrade: 1 }, performance: { totalTrades: 89, winRate: 54, profitFactor: 1.12, sharpeRatio: 0.85, maxDrawdown: 18.5, totalProfit: 1250, averageWin: 65, averageLoss: 55 } },
  { id: '3', name: 'Breakout Scalper', description: 'Quick trades on breakout patterns', type: 'scalping', enabled: true, indicators: [], conditions: [], riskManagement: { stopLoss: 10, takeProfit: 20, maxPositions: 10, maxDrawdown: 5, riskPerTrade: 0.5 }, performance: { totalTrades: 542, winRate: 72, profitFactor: 2.1, sharpeRatio: 2.15, maxDrawdown: 4.2, totalProfit: 2180, averageWin: 12, averageLoss: 8 } },
];

router.get('/', (req, res) => {
  res.json(strategies);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const strategy = strategies.find(s => s.id === id);
  
  if (!strategy) {
    return res.status(404).json({ error: 'Strategy not found' });
  }
  
  res.json(strategy);
});

router.post('/', (req, res) => {
  const strategy = {
    id: uuid(),
    ...req.body,
    enabled: false,
    performance: null,
  };
  
  strategies.push(strategy);
  res.json(strategy);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const index = strategies.findIndex(s => s.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Strategy not found' });
  }
  
  strategies[index] = { ...strategies[index], ...req.body };
  res.json(strategies[index]);
});

router.post('/:id/toggle', (req, res) => {
  const { id } = req.params;
  const strategy = strategies.find(s => s.id === id);
  
  if (!strategy) {
    return res.status(404).json({ error: 'Strategy not found' });
  }
  
  strategy.enabled = !strategy.enabled;
  res.json(strategy);
});

export { router as strategiesRouter };
