import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { useStore } from '../store';
import styles from './Trading.module.css';

export function Trading() {
  const { prices, addToast, showConfirm } = useStore();
  const [symbol, setSymbol] = useState('EURUSD');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [volume, setVolume] = useState('0.01');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');

  const currentPrice = prices[symbol] || { bid: 1.0850, ask: 1.0852, change: 0.12 };

  const handleTrade = () => {
    showConfirm({
      type: side === 'buy' ? 'info' : 'warning',
      title: `Confirm ${side.toUpperCase()} Order`,
      message: `Place ${side.toUpperCase()} order for ${volume} lots of ${symbol}?`,
      confirmText: side === 'buy' ? 'Buy' : 'Sell',
      onConfirm: () => {
        addToast({
          type: 'success',
          title: 'Order Executed',
          message: `${side.toUpperCase()} ${volume} lots of ${symbol}`,
        });
      },
    });
  };

  return (
    <div className={styles.trading}>
      <div className={styles.grid}>
        {/* Order Form */}
        <Card className={styles.orderCard}>
          <h3 className={styles.cardTitle}>Place Order</h3>
          
          <div className={styles.symbolSelect}>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              <option value="EURUSD">EUR/USD</option>
              <option value="GBPUSD">GBP/USD</option>
              <option value="USDJPY">USD/JPY</option>
              <option value="XAUUSD">XAU/USD (Gold)</option>
              <option value="BTCUSD">BTC/USD</option>
            </select>
          </div>

          <div className={styles.priceDisplay}>
            <div className={styles.priceBox}>
              <span className={styles.priceLabel}>Bid</span>
              <span className={styles.bidPrice}>{currentPrice.bid.toFixed(5)}</span>
            </div>
            <div className={styles.priceBox}>
              <span className={styles.priceLabel}>Ask</span>
              <span className={styles.askPrice}>{currentPrice.ask.toFixed(5)}</span>
            </div>
          </div>

          <div className={styles.sideToggle}>
            <button 
              className={`${styles.sideBtn} ${styles.buyBtn} ${side === 'buy' ? styles.active : ''}`}
              onClick={() => setSide('buy')}
            >
              BUY
            </button>
            <button 
              className={`${styles.sideBtn} ${styles.sellBtn} ${side === 'sell' ? styles.active : ''}`}
              onClick={() => setSide('sell')}
            >
              SELL
            </button>
          </div>

          <div className={styles.formGroup}>
            <label>Volume (lots)</label>
            <input 
              type="number" 
              value={volume} 
              onChange={(e) => setVolume(e.target.value)}
              min="0.01"
              step="0.01"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Stop Loss</label>
              <input 
                type="number" 
                value={sl} 
                onChange={(e) => setSl(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Take Profit</label>
              <input 
                type="number" 
                value={tp} 
                onChange={(e) => setTp(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <button className={`${styles.submitBtn} ${side === 'buy' ? styles.buySubmit : styles.sellSubmit}`} onClick={handleTrade}>
            {side === 'buy' ? 'Buy' : 'Sell'} {symbol}
          </button>
        </Card>

        {/* Quick Trade */}
        <Card className={styles.quickCard}>
          <h3 className={styles.cardTitle}>Quick Trade</h3>
          <div className={styles.quickButtons}>
            <button className={styles.quickBtn} onClick={() => { setSide('buy'); setVolume('0.01'); }}>
              <span className={styles.quickLabel}>Buy 0.01</span>
            </button>
            <button className={styles.quickBtn} onClick={() => { setSide('sell'); setVolume('0.01'); }}>
              <span className={styles.quickLabel}>Sell 0.01</span>
            </button>
            <button className={styles.quickBtn} onClick={() => { setSide('buy'); setVolume('0.1'); }}>
              <span className={styles.quickLabel}>Buy 0.1</span>
            </button>
            <button className={styles.quickBtn} onClick={() => { setSide('sell'); setVolume('0.1'); }}>
              <span className={styles.quickLabel}>Sell 0.1</span>
            </button>
          </div>
        </Card>

        {/* Order Book */}
        <Card className={styles.orderBook}>
          <h3 className={styles.cardTitle}>Order Book</h3>
          <div className={styles.bookHeader}>
            <span>Price</span>
            <span>Volume</span>
          </div>
          <div className={styles.bookAsks}>
            {[1.0855, 1.0854, 1.0853, 1.0852, 1.0851].map((price, i) => (
              <div key={i} className={styles.bookRow}>
                <span className={styles.askRow}>{price.toFixed(5)}</span>
                <span className={styles.volumeRow}>{(Math.random() * 100).toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className={styles.spread}>
            <span>Spread</span>
            <span>{(currentPrice.ask - currentPrice.bid).toFixed(5)}</span>
          </div>
          <div className={styles.bookBids}>
            {[1.0849, 1.0848, 1.0847, 1.0846, 1.0845].map((price, i) => (
              <div key={i} className={styles.bookRow}>
                <span className={styles.bidRow}>{price.toFixed(5)}</span>
                <span className={styles.volumeRow}>{(Math.random() * 100).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
