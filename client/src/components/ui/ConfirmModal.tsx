import { useStore } from '../../store';
import styles from './ConfirmModal.module.css';

const icons = {
  danger: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

export function ConfirmModal() {
  const { confirmModal, hideConfirm } = useStore();

  if (!confirmModal) return null;

  const handleConfirm = () => {
    confirmModal.onConfirm?.();
    hideConfirm();
  };

  const handleCancel = () => {
    confirmModal.onCancel?.();
    hideConfirm();
  };

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={`${styles.iconWrapper} ${styles[confirmModal.type]}`}>
          <span className={styles.icon}>{icons[confirmModal.type]}</span>
        </div>
        
        <h2 className={styles.title}>{confirmModal.title}</h2>
        <p className={styles.message}>{confirmModal.message}</p>
        
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={handleCancel}>
            {confirmModal.cancelText || 'Cancel'}
          </button>
          <button 
            className={`${styles.confirmBtn} ${styles[confirmModal.type]}`} 
            onClick={handleConfirm}
          >
            {confirmModal.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
