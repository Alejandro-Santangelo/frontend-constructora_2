import { useDispatch, useSelector } from 'react-redux';

// Hook personalizado para dispatch tipado
export const useAppDispatch = () => useDispatch();

// Hook personalizado para selector tipado
export const useAppSelector = useSelector;

// Hooks específicos para funcionalidad común
export const useNotifications = () => {
  const dispatch = useAppDispatch();
  const notification = useAppSelector(state => state.app.notification);
  
  const showNotification = (message, type = 'info') => {
    dispatch({ type: 'app/showNotification', payload: { message, type } });
  };
  
  const hideNotification = () => {
    dispatch({ type: 'app/hideNotification' });
  };
  
  return { notification, showNotification, hideNotification };
};

export const useTenant = () => {
  const dispatch = useAppDispatch();
  const currentTenantId = useAppSelector(state => state.app.currentTenantId);
  
  const setCurrentTenant = (tenantId) => {
    dispatch({ type: 'app/setCurrentTenant', payload: tenantId });
  };
  
  return { currentTenantId, setCurrentTenant };
};