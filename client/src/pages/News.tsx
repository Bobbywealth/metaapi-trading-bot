import { Card } from '../components/ui/Card';
import styles from './News.module.css';

const news = [
  { id: '1', title: 'Fed Signals Potential Rate Cut in Q2', source: 'Reuters', time: '2h ago', sentiment: 'positive', impact: 'high', symbols: ['EURUSD', 'USDJPY'] },
  { id: '2', title: 'Gold Reaches New All-Time High', source: 'Bloomberg', time: '4h ago', sentiment: 'positive', impact: 'high', symbols: ['XAUUSD'] },
  { id: '3', title: 'Bitcoin Consolidates After Rally', source: 'CoinDesk', time: '6h ago', sentiment: 'neutral', impact: 'medium', symbols: ['BTCUSD'] },
];

export function News() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Market News</h2>
        <div className={styles.filters}>
          <button className={styles.filter}>All</button>
          <button className={styles.filter}>High Impact</button>
          <button className={styles.filter}>Forex</button>
        </div>
      </div>
      <div className={styles.list}>
        {news.map((n) => (
          <Card key={n.id} className={styles.item}>
            <div className={styles.itemHeader}>
              <span className={`${styles.sentiment} ${styles[n.sentiment]}`}>{n.sentiment}</span>
              <span className={styles.impact}>{n.impact} impact</span>
            </div>
            <h3 className={styles.title}>{n.title}</h3>
            <div className={styles.meta}>
              <span>{n.source}</span>
              <span>{n.time}</span>
            </div>
            <div className={styles.symbols}>
              {n.symbols.map((s) => <span key={s} className={styles.symbol}>{s}</span>)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
