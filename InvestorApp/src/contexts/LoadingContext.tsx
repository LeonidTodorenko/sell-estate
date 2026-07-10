import React, { createContext, useContext, useMemo, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

type LoadingContextValue = {
  loading: boolean;
  setLoading: (value: boolean) => void;
  showLoading: () => void;
  hideLoading: () => void;
};

const LoadingContext = createContext<LoadingContextValue>({
  loading: false,
  setLoading: () => {},
  showLoading: () => {},
  hideLoading: () => {},
});

let externalShowLoading: (() => void) | null = null;
let externalHideLoading: (() => void) | null = null;

export const showGlobalLoading = () => {
  externalShowLoading?.();
};

export const hideGlobalLoading = () => {
  externalHideLoading?.();
};

export const useLoading = () => useContext(LoadingContext);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loadingCount, setLoadingCount] = useState(0);

  const showLoading = () => {
    setLoadingCount((v) => v + 1);
  };

  const hideLoading = () => {
    setLoadingCount((v) => Math.max(0, v - 1));
  };

  const setLoading = (value: boolean) => {
    setLoadingCount(value ? 1 : 0);
  };

  externalShowLoading = showLoading;
  externalHideLoading = hideLoading;

  const loading = loadingCount > 0;

  const value = useMemo(
    () => ({
      loading,
      setLoading,
      showLoading,
      hideLoading,
    }),
    [loading],
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}

      {loading && (
        <View style={styles.overlay} pointerEvents="auto">
          <ActivityIndicator size="large" color="#11A36A" />
        </View>
      )}
    </LoadingContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
});