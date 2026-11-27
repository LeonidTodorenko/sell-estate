import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { loadSession } from '../services/sessionStorage';
import { AssistantScenarioCard, readScenario } from './AssistantScenarioCard';

function useInsight<T>(path: string, enabled: boolean) {
  const session = useQuery({
    queryKey: ['insights-session'],
    queryFn: loadSession,
    enabled,
    staleTime: 0,
  });
  const owner = session.data?.user?.userId;
  return useQuery({
    queryKey: ['investment-insights', owner, session.data?.isDemo, path],
    queryFn: async ({ signal }) => (await api.get<T>(path, { signal, silentLoading: true } as any)).data,
    enabled: enabled && !!owner && !session.isFetching,
    staleTime: 60_000,
    retry: false,
  });
}

export function PropertyAIInsights({ id, onOpenAssistant }: { id: string; onOpenAssistant?: () => void }) {
  const [open, setOpen] = useState(false);
  const result = useInsight<{ forecast?: unknown; status?: string }>(`/assistant/property-insights/${encodeURIComponent(id)}`, open);
  const card = readScenario(result.data?.forecast);
  return <View style={styles.panel}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.button} onPress={() => setOpen(!open)}>
      <Text style={styles.heading}>AI Insights · One-share forecast</Text>
    </Pressable>
    {open && <>{result.isFetching && <Text style={styles.text}>Loading forecast…</Text>}
      {result.isError && <Pressable accessibilityRole="button" style={styles.button} onPress={() => void result.refetch()}><Text style={styles.text}>Forecast unavailable · Retry</Text></Pressable>}
      {result.data?.status === 'no_data' && <Text style={styles.text}>There are no current approved forecast rates.</Text>}
      {card && <AssistantScenarioCard card={card}/>}
      {onOpenAssistant && <Pressable accessibilityRole="button" style={styles.button} onPress={onOpenAssistant}>
        <Text style={styles.heading}>Open forecast in AI Assistant</Text>
      </Pressable>}
    </>}
  </View>;
}

type Portfolio = { demo: boolean; balance: number; propertyCount: number; concentration: number | null };

export function PortfolioAIInsights({ onOpenAssistant }: { onOpenAssistant?: () => void }) {
  const [open, setOpen] = useState(false);
  const result = useInsight<Portfolio>('/assistant/portfolio-insights', open);
  const data = result.data;
  return <View style={styles.panel}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.button} onPress={() => setOpen(!open)}>
      <Text style={styles.heading}>AI Insights · Portfolio</Text>
    </Pressable>
    {open && <>{result.isFetching && <Text style={styles.text}>Loading portfolio…</Text>}
      {result.isError && <Pressable accessibilityRole="button" style={styles.button} onPress={() => void result.refetch()}><Text style={styles.text}>Portfolio insights unavailable · Retry</Text></Pressable>}
      {data && Number.isFinite(data.balance) && Number.isFinite(data.propertyCount) && <Text style={styles.text}>
        {data.demo ? 'Demo · ' : ''}Available balance: {data.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. Confirmed holdings: {data.propertyCount} {data.propertyCount === 1 ? 'property' : 'properties'}.
        {data.concentration != null && ` Largest position: ${data.concentration}% of recorded investment cost.`}
      </Text>}
      {onOpenAssistant && <Pressable accessibilityRole="button" style={styles.button} onPress={onOpenAssistant}>
        <Text style={styles.heading}>Ask AI about my asset structure</Text>
      </Pressable>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: 10, marginVertical: 6, backgroundColor: '#edf5ef', borderRadius: 12 },
  button: { minHeight: 44, justifyContent: 'center' },
  heading: { fontSize: 15, fontWeight: '700', color: '#264538' },
  text: { color: '#264538', marginBottom: 6 },
});
