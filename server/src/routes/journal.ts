import { Router } from 'express';
import { v4 as uuid } from 'uuid';

const router = Router();

const entries = [
  { id: '1', symbol: 'EURUSD', type: 'buy', volume: 0.01, pnl: 125.50, setup: 'Breakout at 1.0850 with volume confirmation', tags: ['breakout', 'trend'], date: '2024-01-15T10:00:00Z', notes: '' },
  { id: '2', symbol: 'GBPUSD', type: 'sell', volume: 0.02, pnl: -45.20, setup: 'Mean reversion from 1.2700 resistance', tags: ['mean-reversion'], date: '2024-01-14T15:30:00Z', notes: 'Stop was too tight' },
  { id: '3', symbol: 'XAUUSD', type: 'buy', volume: 0.1, pnl: 340.00, setup: 'Golden cross on 4H chart', tags: ['gold', 'cross'], date: '2024-01-13T08:00:00Z', notes: '' },
];

router.get('/', (req, res) => {
  const { symbol, startDate, endDate, limit = 50 } = req.query;
  
  let filtered = [...entries];
  
  if (symbol) {
    filtered = filtered.filter(e => e.symbol === symbol);
  }
  if (startDate) {
    filtered = filtered.filter(e => e.date >= (startDate as string));
  }
  if (endDate) {
    filtered = filtered.filter(e => e.date <= (endDate as string));
  }
  
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  res.json(filtered.slice(0, Number(limit)));
});

router.get('/stats', (req, res) => {
  const total = entries.length;
  const wins = entries.filter(e => e.pnl > 0).length;
  const losses = entries.filter(e => e.pnl < 0).length;
  const totalPnl = entries.reduce((sum, e) => sum + e.pnl, 0);
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  
  res.json({
    total,
    wins,
    losses,
    winRate: winRate.toFixed(1),
    totalPnl: totalPnl.toFixed(2),
    avgWin: wins > 0 ? (entries.filter(e => e.pnl > 0).reduce((sum, e) => sum + e.pnl, 0) / wins).toFixed(2) : 0,
    avgLoss: losses > 0 ? Math.abs(entries.filter(e => e.pnl < 0).reduce((sum, e) => sum + e.pnl, 0) / losses).toFixed(2) : 0,
  });
});

router.post('/', (req, res) => {
  const entry = {
    id: uuid(),
    ...req.body,
    date: new Date().toISOString(),
  };
  
  entries.push(entry);
  res.json(entry);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const index = entries.findIndex(e => e.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  
  entries[index] = { ...entries[index], ...req.body };
  res.json(entries[index]);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = entries.findIndex(e => e.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  
  entries.splice(index, 1);
  res.json({ success: true });
});

export { router as journalRouter };
