import { Card } from '../components/ui/Card';
import styles from './Journal.module.css';

const trades = [
  { id: '1', symbol: 'EURUSD', type: 'buy', profit: 125.50, date: '2024-01-15', setup: 'Breakout at 1.0850' },
  { id: '2', symbol: 'GBPUSD', type: 'sell', profit: -45.20, date: '2024-01-14', setup: 'Mean reversion' },
  { id: '3', symbol: 'XAUUSD', type: 'buy', profit: 340.00, date: '2024-01-13', setup: 'Golden cross on 4H' },
];

export function Journal() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Trade Journal</h2>
        <button className={styles.addBtn}>+ Add Entry</button>
      </div>
      <Card className={styles.stats}>
        <div className={styles.stat}><span>142</span><label>Total Trades</label></div>
        <div className={styles.stat}><span className={styles.profit}>67.5%</span><label>Win Rate</label></div>
        <div className={styles.stat}><span className={styles.profit}>$4,230</span><label>Total P&L</label></div>
      </Card>
      <div className={styles.list}>
        {trades.map((t) => (
          <Card key={t.id} className={styles.trade}>
            <div className={styles.tradeHeader}>
              <span className={styles.symbol}>{t.symbol}</span>
              <span className={`${styles.type} ${t.type === 'buy' ? styles.long : styles.short}`}>{t.type.toUpperCase()}</span>
              <span className={`${styles.profit} ${t.profit >= 0 ? styles.positive : styles.negative}`}>{t.profit >= 0 ? '+' : ''}{t.profit.toFixed(2)}</span>
            </div>
            <p className={styles.setup}>{t.setup}</p>
            <span className={styles.date}>{t.date}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
