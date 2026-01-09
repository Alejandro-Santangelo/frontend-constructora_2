import React, { useEffect } from 'react';

const NotificationToast = ({ show, message, variant, type, onHide, onClose }) => {
  const finalType = type || variant || 'info';
  const finalOnHide = onHide || onClose;
  
  useEffect(() => {
    if (show && finalOnHide) {
      const timer = setTimeout(() => {
        finalOnHide();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [show, finalOnHide]);

  if (!show) return null;
  if (!show) return null;

  const getTypeClass = () => {
    switch (finalType) {
      case 'success': return 'text-bg-success';
      case 'error': return 'text-bg-danger';
      case 'danger': return 'text-bg-danger';
      case 'warning': return 'text-bg-warning';
      default: return 'text-bg-info';
    }
  };

  const getIcon = () => {
    switch (finalType) {
      case 'success': return 'fas fa-check-circle';
      case 'error': return 'fas fa-exclamation-circle';
      case 'danger': return 'fas fa-exclamation-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      default: return 'fas fa-info-circle';
    }
  };

  return (
    <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1050 }}>
      <div className={`toast show ${getTypeClass()}`} role="alert">
        <div className="toast-header">
          <i className={`${getIcon()} me-2`}></i>
          <strong className="me-auto">Notificación</strong>
          <button 
            type="button" 
            className="btn-close" 
            onClick={finalOnHide}
            aria-label="Close"
          ></button>
        </div>
        <div className="toast-body">
          {message}
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;