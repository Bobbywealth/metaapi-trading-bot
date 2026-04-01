import { Card } from '../components/ui/Card';
import { Chart } from '../components/chart/Chart';
import styles from './Analytics.module.css';

export function Analytics() {
  return (
    <div className={styles.container}>
      <h2>Analytics Dashboard</h2>
      <div className={styles.grid}>
        <Card className={styles.chartCard}>
          <h3>Equity Curve</h3>
          <div className={styles.chartWrapper}><Chart /></div>
        </Card>
        <Card className={styles.stats}>
          <h3>Performance Metrics</h3>
          <div className={styles.statGrid}>
            <div className={styles.metric}><span>Win Rate</span><strong>67.5%</strong></div>
            <div className={styles.metric}><span>Profit Factor</span><strong>1.85</strong></div>
            <div className={styles.metric}><span>Sharpe Ratio</span><strong>1.42</strong></div>
            <div className={styles.metric}><span>Max Drawdown</span><strong className={styles.loss}>-12.3%</strong></div>
          </div>
        </Card>
        <Card className={styles.distribution}>
          <h3>Win/Loss Distribution</h3>
          <div className={styles.bars}>
            <div className={styles.bar}><div className={styles.winner} style={{height: '68%'}} /><span>Wins</span></div>
            <div className={styles.bar}><div className={styles.loser} style={{height: '32%'}} /><span>Losses</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
