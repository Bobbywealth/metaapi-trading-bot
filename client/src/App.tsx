import { useState, useEffect } from 'react';
import { useStore } from './store';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { ToastContainer } from './components/ui/Toast';
import { ConfirmModal } from './components/ui/ConfirmModal';
import { Dashboard } from './pages/Dashboard';
import { Trading } from './pages/Trading';
import { Positions } from './pages/Positions';
import { Strategies } from './pages/Strategies';
import { Journal } from './pages/Journal';
import { News } from './pages/News';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import styles from './App.module.css';

type Page = 'dashboard' | 'trading' | 'positions' | 'strategies' | 'journal' | 'news' | 'analytics' | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, initialize } = useStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'trading': return <Trading />;
      case 'positions': return <Positions />;
      case 'strategies': return <Strategies />;
      case 'journal': return <Journal />;
      case 'news': return <News />;
      case 'analytics': return <Analytics />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className={styles.app}>
      <Header 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
        currentPage={currentPage}
      />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page);
          setSidebarOpen(false);
        }}
        onClose={() => setSidebarOpen(false)}
      />
      
      <main className={styles.main}>
        <div className={styles.content}>
          {renderPage()}
        </div>
      </main>
      
      <BottomNav 
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />
      
      <ToastContainer />
      <ConfirmModal />
    </div>
  );
}
