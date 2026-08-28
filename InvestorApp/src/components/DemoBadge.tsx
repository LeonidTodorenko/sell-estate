import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function DemoBadge({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>DEMO · Virtual transactions</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#FFF4D6',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    color: '#8A5A00',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
