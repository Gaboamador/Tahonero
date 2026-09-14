import { useEffect, useState } from 'react';
import {
  subscribeToEmpanadaConfig,
  subscribeToEmpanadaOrders,
} from '@/features/empanadas/services/empanadaService';

export function useEmpanadaModuleData(groupId) {
  const [config, setConfig] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState({ config: true, orders: true });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!groupId) {
      setConfig(null);
      setOrders([]);
      setLoading({ config: false, orders: false });
      return undefined;
    }

    setLoading({ config: true, orders: true });
    setError('');

    const handleError = (part) => (err) => {
      console.error('No se pudo cargar Empanadas:', err);
      setError('No se pudieron cargar todos los datos de Empanadas.');
      setLoading((current) => ({ ...current, [part]: false }));
    };

    const unsubConfig = subscribeToEmpanadaConfig(
      groupId,
      (value) => {
        setConfig(value);
        setLoading((current) => ({ ...current, config: false }));
      },
      handleError('config'),
    );
    const unsubOrders = subscribeToEmpanadaOrders(
      groupId,
      (value) => {
        setOrders(value);
        setLoading((current) => ({ ...current, orders: false }));
      },
      handleError('orders'),
    );

    return () => {
      unsubConfig();
      unsubOrders();
    };
  }, [groupId]);

  return {
    config,
    orders,
    isLoading: loading.config || loading.orders,
    error,
  };
}
