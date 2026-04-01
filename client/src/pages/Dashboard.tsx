import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import { Chart } from '../components/chart/Chart';
import styles from './Dashboard.module.css';

type Page = 'dashboard' | 'trading' | 'positions' | 'strategies' | 'journal' | 'news' | 'analytics' | 'settings';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { account, positions, prices, isConnected, strategies } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const winRate = 67.5;
  const totalTrades = 142;
  const activeStrategies = strategies.filter(s => s.enabled).length;

  return (
    <div className={`${styles.dashboard} ${mounted ? styles.mounted : ''}`}>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <Card className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Account Balance</span>
            <span className={styles.kpiIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M12 12a3 3 0 1 0 0-2 3 3 0 0 0 0 2z" />
                <path d="M2 12h2m16 0h2M12 2v2" />
              </svg>
            </span>
          </div>
          <div className={styles.kpiValue}>{formatCurrency(account.balance)}</div>
          <div className={`${styles.kpiChange} ${account.unrealizedPnl >= 0 ? styles.positive : styles.negative}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {account.unrealizedPnl >= 0 ? (
                <polyline points="18 15 12 9 6 15" />
              ) : (
                <polyline points="6 9 12 15 18 9" />
              )}
            </svg>
            <span>{formatCurrency(Math.abs(account.unrealizedPnl))} Today</span>
          </div>
        </Card>

        <Card className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Equity</span>
            <span className={`${styles.kpiIcon} ${styles.equity}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
              </svg>
            </span>
          </div>
          <div className={`${styles.kpiValue} ${account.unrealizedPnl >= 0 ? styles.positive : styles.negative}`}>
            {formatCurrency(account.equity)}
          </div>
          <div className={styles.kpiSubtext}>
            Margin: {formatCurrency(account.margin)} · Free: {formatCurrency(account.freeMargin)}
          </div>
        </Card>

        <Card className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Open Positions</span>
            <span className={`${styles.kpiIcon} ${styles.positions}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
          </div>
          <div className={styles.kpiValue}>{positions.length}</div>
          <div className={styles.kpiSubtext}>
            {positions.filter(p => p.profit > 0).length} profitable
          </div>
        </Card>

        <Card className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Win Rate</span>
            <span className={`${styles.kpiIcon} ${styles.winRate}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
              </svg>
            </span>
          </div>
          <div className={`${styles.kpiValue} ${styles.positive}`}>{winRate}%</div>
          <div className={styles.kpiSubtext}>{totalTrades} total trades</div>
        </Card>

        <Card className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Active Strategies</span>
            <span className={`${styles.kpiIcon} ${styles.strategies}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </span>
          </div>
          <div className={styles.kpiValue}>{activeStrategies}</div>
          <div className={styles.kpiSubtext}>
            {strategies.length} total strategies
          </div>
        </Card>

        <Card className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Connection</span>
            <span className={`${styles.kpiIcon} ${isConnected ? styles.connected : styles.disconnected}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <circle cx="12" cy="20" r="1" />
              </svg>
            </span>
          </div>
          <div className={`${styles.kpiValue} ${isConnected ? styles.positive : styles.negative}`}>
            {isConnected ? 'Live' : 'Offline'}
          </div>
          <div className={styles.kpiSubtext}>
            {isConnected ? 'Real-time data active' : 'Reconnecting...'}
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className={styles.mainGrid}>
        {/* Chart */}
        <Card className={styles.chartCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Price Chart</h3>
            <div className={styles.chartControls}>
              <select className={styles.symbolSelect}>
                <option value="AAPL">AAPL</option>
                <option value="GOOGL">GOOGL</option>
                <option value="MSFT">MSFT</option>
                <option value="TSLA">TSLA</option>
                <option value="EURUSD">EUR/USD</option>
              </select>
              <div className={styles.timeframeBtns}>
                {['1H', '4H', '1D', '1W'].map((tf) => (
                  <button key={tf} className={`${styles.tfBtn} ${tf === '1H' ? styles.active : ''}`}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.chartWrapper}>
            <Chart />
          </div>
        </Card>

        {/* Positions */}
        <Card className={styles.positionsCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Open Positions</h3>
            <button className={styles.viewAllBtn} onClick={() => onNavigate('positions')}>
              View All
            </button>
          </div>
          <div className={styles.positionsList}>
            {positions.length === 0 ? (
              <div className={styles.emptyState}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                <span>No open positions</span>
                <button className={styles.tradeBtn} onClick={() => onNavigate('trading')}>
                  Start Trading
                </button>
              </div>
            ) : (
              positions.slice(0, 5).map((position) => (
                <div key={position.id} className={styles.positionItem}>
                  <div className={styles.positionInfo}>
                    <span className={styles.positionSymbol}>{position.symbol}</span>
                    <span className={styles.positionMeta}>
                      {position.type.toUpperCase()} · {position.volume} lots
                    </span>
                  </div>
                  <div className={styles.positionPrices}>
                    <span className={styles.positionEntry}>
                      @{position.openPrice.toFixed(5)}
                    </span>
                    <span className={`${styles.positionPnl} ${position.profit >= 0 ? styles.profit : styles.loss}`}>
                      {position.profit >= 0 ? '+' : ''}{position.profit.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Market Overview */}
        <Card className={styles.marketCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Market Overview</h3>
          </div>
          <div className={styles.marketList}>
            {Object.entries(prices).length === 0 ? (
              <>
                {['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'].map((symbol) => (
                  <div key={symbol} className={styles.marketItem}>
                    <div className={styles.marketInfo}>
                      <span className={styles.marketSymbol}>{symbol}</span>
                      <span className={styles.marketName}>Stock</span>
                    </div>
                    <div className={styles.marketPrices}>
                      <span className={styles.marketPrice}>--</span>
                      <span className={styles.marketChange}>--</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              Object.entries(prices).slice(0, 5).map(([symbol, price]) => (
                <div key={symbol} className={styles.marketItem}>
                  <div className={styles.marketInfo}>
                    <span className={styles.marketSymbol}>{symbol}</span>
                    <span className={styles.marketName}>forex</span>
                  </div>
                  <div className={styles.marketPrices}>
                    <span className={styles.marketPrice}>{price.bid.toFixed(5)}</span>
                    <span className={`${styles.marketChange} ${price.change >= 0 ? styles.positive : styles.negative}`}>
                      {price.change >= 0 ? '+' : ''}{price.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
