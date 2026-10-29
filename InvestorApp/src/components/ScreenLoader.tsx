import React from 'react';
import {View, ActivityIndicator, Text, StyleSheet} from 'react-native';

import theme from '../constants/theme';

export default function ScreenLoader() {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading data">
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={{marginTop: 12, color: theme.colors.textSecondary}}>
        Loading…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    justifyContent: 'center',

    alignItems: 'center',

    backgroundColor: theme.colors.background,
  },
});
