import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import styles from './Positions.module.css';

export function Positions() {
  const { positions, showConfirm, addToast } = useStore();

  const handleClose = (id: string, symbol: string) => {
    showConfirm({
      type: 'danger',
      title: 'Close Position',
      message: `Close ${symbol} position?`,
      confirmText: 'Close',
      onConfirm: () => {
        addToast({ type: 'success', title: 'Position Closed', message: `${symbol} position closed` });
      },
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Open Positions</h2>
        <span className={styles.count}>{positions.length} positions</span>
      </div>

      {positions.length === 0 ? (
        <Card className={styles.empty}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <h3>No Open Positions</h3>
          <p>Your open positions will appear here</p>
        </Card>
      ) : (
        <div className={styles.list}>
          {positions.map((pos) => (
            <Card key={pos.id} className={styles.positionCard}>
              <div className={styles.positionHeader}>
                <div className={styles.symbol}>
                  <span className={styles.symbolName}>{pos.symbol}</span>
                  <span className={`${styles.type} ${pos.type === 'buy' ? styles.long : styles.short}`}>
                    {pos.type.toUpperCase()}
                  </span>
                </div>
                <span className={`${styles.pnl} ${pos.profit >= 0 ? styles.profit : styles.loss}`}>
                  {pos.profit >= 0 ? '+' : ''}{pos.profit.toFixed(2)}
                </span>
              </div>
              <div className={styles.details}>
                <div className={styles.detail}>
                  <span>Volume</span>
                  <span>{pos.volume} lots</span>
                </div>
                <div className={styles.detail}>
                  <span>Open Price</span>
                  <span>{pos.openPrice.toFixed(5)}</span>
                </div>
                <div className={styles.detail}>
                  <span>Current</span>
                  <span>{pos.currentPrice.toFixed(5)}</span>
                </div>
                <div className={styles.detail}>
                  <span>SL/TP</span>
                  <span>{pos.stopLoss ? pos.stopLoss.toFixed(5) : '-'} / {pos.takeProfit ? pos.takeProfit.toFixed(5) : '-'}</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => handleClose(pos.id, pos.symbol)}>
                Close Position
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
