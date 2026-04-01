import { useStore } from '../../store';
import styles from './Header.module.css';

interface HeaderProps {
  onMenuClick: () => void;
  currentPage: string;
}

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  trading: 'Trading',
  positions: 'Positions',
  strategies: 'Strategies',
  journal: 'Trade Journal',
  news: 'Market News',
  analytics: 'Analytics',
  settings: 'Settings',
};

export function Header({ onMenuClick, currentPage }: HeaderProps) {
  const { isConnected, account, addToast } = useStore();
  
  const handleRefresh = () => {
    addToast({
      type: 'info',
      title: 'Refreshing...',
      message: 'Updating all market data',
    });
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        
        <div className={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
          <span className={styles.title}>AI Trading Station</span>
        </div>
      </div>
      
      <div className={styles.center}>
        <span className={styles.pageTitle}>{pageTitles[currentPage] || 'Dashboard'}</span>
      </div>
      
      <div className={styles.right}>
        <div className={`${styles.connectionStatus} ${isConnected ? styles.connected : styles.disconnected}`}>
          <span className={styles.dot} />
          <span>{isConnected ? 'Live' : 'Offline'}</span>
        </div>
        
        {isConnected && (
          <div className={styles.equity}>
            <span className={styles.label}>Equity</span>
            <span className={`${styles.value} ${account.unrealizedPnl >= 0 ? styles.profit : styles.loss}`}>
              ${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
        
        <button className={styles.refreshBtn} onClick={handleRefresh} aria-label="Refresh data">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
        
        <button className={styles.settingsBtn} aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
