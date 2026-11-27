import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import theme from '../constants/theme';

type Amount = { id?: string; label: string; value: number };
const itemKey = (row: Amount) => row.id ?? row.label;
const colors = ['#087a4e', '#3c91a0', '#a66b2b', '#7b6ab1'];
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export default function AssetAllocation({ title, items, description, russian = false }: {
  title: string;
  items: Amount[];
  description: string;
  russian?: boolean;
}) {
  const [selection, setSelection] = useState<string>();
  const rows = items.filter(row => Number.isFinite(row.value) && row.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const negative = items.filter(row => Number.isFinite(row.value) && row.value < 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const selected = rows.find(row => itemKey(row) === selection);
  const circumference = 2 * Math.PI * 46;
  let offset = 0;

  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={styles.text}>{description}</Text>
    {rows.length > 0 ? <>
      <View style={styles.visual}>
        <Svg width={176} height={176} viewBox="0 0 120 120" accessible={false}>
          {rows.map((row, index) => {
            const length = row.value / total * circumference;
            const start = offset;
            offset += length;
            return <Circle key={itemKey(row)} cx={60} cy={60} r={46} fill="none"
              stroke={colors[index % colors.length]} strokeWidth={row === selected ? 22 : 18}
              strokeDasharray={[length, circumference - length]} strokeDashoffset={-start}
              rotation={-90} originX={60} originY={60} onPress={() => setSelection(itemKey(row))}/>;
          })}
        </Svg>
        <View pointerEvents="none" style={styles.selection} accessibilityLiveRegion="polite">
          <Text style={styles.center}>{selected?.label ?? (russian ? 'Положительный итог' : 'Positive total')}</Text>
          <Text style={styles.center}>{money.format(selected?.value ?? total)}</Text>
          {selected && <Text style={styles.center}>{percent.format(selected.value / total)}</Text>}
        </View>
      </View>
      {rows.map((row, index) => <Pressable key={itemKey(row)}
        accessibilityRole="button" accessibilityState={{ selected: row === selected }}
        style={[styles.row, row === selected && styles.active]}
        onPress={() => setSelection(itemKey(row))}>
        <View style={[styles.dot, { backgroundColor: colors[index % colors.length] }]}/>
        <Text style={styles.label}>{row.label}</Text>
        <Text style={styles.text}>{money.format(row.value)} ({percent.format(row.value / total)})</Text>
      </Pressable>)}
    </> : <Text style={styles.text}>No positive amounts available</Text>}
    {negative.length > 0 && <>
      <Text accessibilityRole="header" style={styles.title}>{russian ? "Отрицательные суммы" : "Negative amounts"}</Text>
      {negative.map(row => <View key={itemKey(row)} style={styles.row}>
        <Text style={styles.label}>{row.label}</Text><Text style={styles.text}>{money.format(row.value)}</Text>
      </View>)}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 16, backgroundColor: theme.colors.surface, gap: 8 },
  title: { color: theme.colors.text, fontWeight: '700', fontSize: 16 },
  text: { color: theme.colors.textSecondary, flexShrink: 1 },
  visual: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  selection: { position: 'absolute', width: 88, gap: 2 },
  center: { color: theme.colors.text, fontSize: 11, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', minHeight: 44, gap: 8, paddingHorizontal: 8 },
  active: { backgroundColor: '#e7f4ed', borderRadius: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { color: theme.colors.text, flexGrow: 1, flexShrink: 1 },
});
