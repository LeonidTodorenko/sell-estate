import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

interface Investment {
  id: string;
  property: string;
  amount: string;
}

const InvestmentsScreen = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);

  useEffect(() => {
    // TODO: Replace with API call
    setInvestments([
      { id: '1', property: 'Dubai Marina Apartment', amount: '5000 USD' },
      { id: '2', property: 'Palm Jumeirah Villa', amount: '10000 USD' },
    ]);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Investments</Text>
      <FlatList
        data={investments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Property: {item.property}</Text>
            <Text>Amount: {item.amount}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: {
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
});

export default InvestmentsScreen;
