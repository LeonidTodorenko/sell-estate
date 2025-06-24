import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import api from '../api';
import { Picker } from '@react-native-picker/picker';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Trade {
  timestamp: string;
  shares: number;
  pricePerShare: number;
  propertyTitle: string;
}

const TradeHistoryScreen = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const screenWidth = Dimensions.get('window').width - 32;

  const loadTrades = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/share-offers/transactions');
      setTrades(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  useEffect(() => {
    let filtered = trades;
    if (selectedProperty) {
      filtered = filtered.filter(t => t.propertyTitle === selectedProperty);
    }
    if (startDate) {
      filtered = filtered.filter(t => new Date(t.timestamp) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(t => new Date(t.timestamp) <= endDate);
    }
    setFilteredTrades(filtered);
  }, [trades, selectedProperty, startDate, endDate]);

  const uniqueProperties = [...new Set(trades.map(t => t.propertyTitle))];

  const sortedTrades = [...filteredTrades].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const chartData = {
    labels: sortedTrades.map(t => new Date(t.timestamp).toLocaleDateString()),
    datasets: [{
      data: sortedTrades.map(t => t.pricePerShare),
      color: () => '#0080FF',
      strokeWidth: 2,
    }]
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trade History</Text>

      {/* Property selector */}
      <Picker
        selectedValue={selectedProperty}
        onValueChange={value => setSelectedProperty(value)}
        style={styles.picker}
      >
        <Picker.Item label="All Properties" value={null} />
        {uniqueProperties.map(prop => (
          <Picker.Item key={prop} label={prop} value={prop} />
        ))}
      </Picker>

      {/* Date pickers */}
      <View style={styles.dateRow}>
        <Text style={styles.dateText} onPress={() => setShowStartPicker(true)}>
          From: {startDate ? startDate.toLocaleDateString() : 'Select'}
        </Text>
        <Text style={styles.dateText} onPress={() => setShowEndPicker(true)}>
          To: {endDate ? endDate.toLocaleDateString() : 'Select'}
        </Text>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setShowStartPicker(false);
            if (date) setStartDate(date);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setShowEndPicker(false);
            if (date) setEndDate(date);
          }}
        />
      )}

      {/* Chart */}
      {selectedProperty && filteredTrades.length > 0 && (
        <View style={{ marginVertical: 20 }}>
          <Text style={styles.chartTitle}>📈 Price Chart for {selectedProperty}</Text>
          <LineChart
            data={chartData}
            width={screenWidth}
            height={220}
            yAxisSuffix="$"
            chartConfig={{
              backgroundColor: '#f5f5dc',
              backgroundGradientFrom: '#f5f5dc',
              backgroundGradientTo: '#f5f5dc',
              decimalPlaces: 2,
              color: () => '#2a1602',
              labelColor: () => '#2a1602',
              propsForDots: { r: '4', strokeWidth: '2' }
            }}
            bezier
          />
        </View>
      )}

      {/* List */}
      {loading ? <ActivityIndicator /> : (
        <FlatList
          data={filteredTrades}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.text}>🏠 {item.propertyTitle}</Text>
              <Text style={styles.text}>📈 Shares: {item.shares}</Text>
              <Text style={styles.text}>💵 Price/Share: ${item.pricePerShare.toFixed(2)}</Text>
              <Text style={styles.text}>📅 Time: {new Date(item.timestamp).toLocaleString()}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

export default TradeHistoryScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  picker: { backgroundColor: '#eee', marginVertical: 10 },
  card: {
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  text: { fontSize: 16 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10
  },
  dateText: {
    fontSize: 16,
    color: 'blue'
  }
});
