import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { useStore } from '../store';
import styles from './Settings.module.css';

export function Settings() {
  const { connect, disconnect, isConnected, addToast } = useStore();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const handleConnect = () => {
    if (!apiKey || !apiSecret) {
      addToast({ type: 'error', title: 'Missing Credentials', message: 'Please enter API key and secret' });
      return;
    }
    connect(apiKey);
    addToast({ type: 'success', title: 'Connected', message: 'Successfully connected to trading API' });
  };

  const handleDisconnect = () => {
    disconnect();
    addToast({ type: 'info', title: 'Disconnected', message: 'Disconnected from trading API' });
  };

  return (
    <div className={styles.container}>
      <h2>Settings</h2>
      <div className={styles.grid}>
        <Card className={styles.section}>
          <h3>Connection</h3>
          <div className={styles.form}>
            <div className={styles.field}>
              <label>API Key</label>
              <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter API key" disabled={isConnected} />
            </div>
            <div className={styles.field}>
              <label>API Secret</label>
              <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="Enter API secret" disabled={isConnected} />
            </div>
            <div className={styles.actions}>
              {isConnected ? (
                <button className={styles.disconnect} onClick={handleDisconnect}>Disconnect</button>
              ) : (
                <button className={styles.connect} onClick={handleConnect}>Connect</button>
              )}
            </div>
          </div>
          <div className={styles.status}>
            <span className={`${styles.dot} ${isConnected ? styles.connected : styles.disconnected}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </Card>
        <Card className={styles.section}>
          <h3>Preferences</h3>
          <div className={styles.pref}>
            <span>Notifications</span>
            <button className={styles.toggle} />
          </div>
          <div className={styles.pref}>
            <span>Sound Alerts</span>
            <button className={`${styles.toggle} ${styles.on}`} />
          </div>
          <div className={styles.pref}>
            <span>Auto-refresh Data</span>
            <button className={`${styles.toggle} ${styles.on}`} />
          </div>
        </Card>
      </div>
    </div>
  );
}
