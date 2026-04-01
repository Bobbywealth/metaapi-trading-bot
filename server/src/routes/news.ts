import { Router } from 'express';

const router = Router();

const news = [
  { id: '1', title: 'Fed Signals Potential Rate Cut in Q2', summary: 'Federal Reserve officials indicated a possible rate reduction in the second quarter amid cooling inflation data.', source: 'Reuters', url: '#', publishedAt: '2024-01-15T14:30:00Z', symbols: ['EURUSD', 'USDJPY'], sentiment: 'positive', sentimentScore: 0.85, impact: 'high', category: 'economic' },
  { id: '2', title: 'Gold Reaches New All-Time High', summary: 'Gold prices surged to a new record high as investors seek safe-haven assets.', source: 'Bloomberg', url: '#', publishedAt: '2024-01-15T10:00:00Z', symbols: ['XAUUSD'], sentiment: 'positive', sentimentScore: 0.72, impact: 'high', category: 'commodity' },
  { id: '3', title: 'Bitcoin Consolidates After Rally', summary: 'Bitcoin is showing consolidation patterns following a week of strong gains above $42,000.', source: 'CoinDesk', url: '#', publishedAt: '2024-01-14T16:00:00Z', symbols: ['BTCUSD'], sentiment: 'neutral', sentimentScore: 0.1, impact: 'medium', category: 'crypto' },
  { id: '4', title: 'EUR/GBP Breaks Key Resistance', summary: 'The Euro strengthened against Sterling as UK economic data disappointed.', source: 'FX Street', url: '#', publishedAt: '2024-01-14T09:00:00Z', symbols: ['GBPUSD'], sentiment: 'negative', sentimentScore: -0.45, impact: 'medium', category: 'technical' },
];

router.get('/', (req, res) => {
  const { symbol, impact, sentiment, limit = 20 } = req.query;
  
  let filtered = [...news];
  
  if (symbol) {
    filtered = filtered.filter(n => n.symbols.includes(symbol as string));
  }
  if (impact) {
    filtered = filtered.filter(n => n.impact === impact);
  }
  if (sentiment) {
    filtered = filtered.filter(n => n.sentiment === sentiment);
  }
  
  res.json(filtered.slice(0, Number(limit)));
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const item = news.find(n => n.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'News item not found' });
  }
  
  res.json(item);
});

export { router as newsRouter };
