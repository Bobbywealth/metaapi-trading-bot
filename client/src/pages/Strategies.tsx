import { Card } from '../components/ui/Card';
import styles from './Strategies.module.css';

const strategies = [
  { id: '1', name: 'Trend Follower', type: 'trend', enabled: true, winRate: 68 },
  { id: '2', name: 'Mean Reversion', type: 'mean_reversion', enabled: false, winRate: 54 },
  { id: '3', name: 'Breakout Scalper', type: 'scalping', enabled: true, winRate: 72 },
  { id: '4', name: 'Range Trader', type: 'mean_reversion', enabled: false, winRate: 61 },
];

export function Strategies() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Trading Strategies</h2>
        <button className={styles.addBtn}>+ New Strategy</button>
      </div>
      <div className={styles.grid}>
        {strategies.map((s) => (
          <Card key={s.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>{s.name}</h3>
              <span className={`${styles.badge} ${styles[s.type]}`}>{s.type.replace('_', ' ')}</span>
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{s.winRate}%</span>
                <span className={styles.statLabel}>Win Rate</span>
              </div>
            </div>
            <div className={styles.toggle}>
              <span>Enabled</span>
              <button className={`${styles.toggleBtn} ${s.enabled ? styles.on : ''}`} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
