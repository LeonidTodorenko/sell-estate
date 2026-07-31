import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

type NetworkContextValue = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOnline: boolean;
  isInitialized: boolean;
};

const NetworkContext = createContext<NetworkContextValue | undefined>(
  undefined,
);

type NetworkProviderProps = {
  children: ReactNode;
};

/**
 * Единый источник состояния сети для приложения.
 *
 * Дополнительно синхронизирует NetInfo с React Query:
 * - при потере интернета React Query перестаёт считать приложение online;
 * - при восстановлении сети активные запросы могут обновиться автоматически.
 */
export function NetworkProvider({ children }: NetworkProviderProps) {
  const [networkState, setNetworkState] = useState<NetworkContextValue>({
    isConnected: true,
    isInternetReachable: null,
    isOnline: true,
    isInitialized: false,
  });

  useEffect(() => {
    const applyNetworkState = (state: NetInfoState) => {
      const isConnected = state.isConnected === true;

      // На некоторых устройствах isInternetReachable сначала равен null.
      // Пока проверка не завершена, ориентируемся на физическое подключение.
      const isOnline =
        isConnected && state.isInternetReachable !== false;

      setNetworkState({
        isConnected,
        isInternetReachable: state.isInternetReachable,
        isOnline,
        isInitialized: true,
      });

      onlineManager.setOnline(isOnline);
    };

    // Получаем начальное состояние сразу, не ожидая первого события подписки.
    void NetInfo.fetch()
      .then(applyNetworkState)
      .catch(error => {
        console.error('[NetworkProvider] Failed to read network state:', error);

        setNetworkState(previous => ({
          ...previous,
          isInitialized: true,
        }));
      });

    const unsubscribe = NetInfo.addEventListener(applyNetworkState);

    return unsubscribe;
  }, []);

  const value = useMemo(() => networkState, [networkState]);

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error('useNetwork must be used inside NetworkProvider');
  }

  return context;
}
