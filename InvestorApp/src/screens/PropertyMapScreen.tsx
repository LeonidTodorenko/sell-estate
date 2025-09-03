// import React, { useEffect, useState } from 'react';
// import { View, StyleSheet, Alert, Text } from 'react-native';
// import MapView, { Marker, UrlTile } from 'react-native-maps';
// import { RouteProp, useRoute } from '@react-navigation/native';
// import { RootStackParamList } from '../navigation/AppNavigator';


import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import theme from '../constants/theme';

type RouteProps = RouteProp<RootStackParamList, 'PropertyMap'>;

const PropertyMapScreen = () => {
  const route = useRoute<RouteProps>();
  const { latitude, longitude, title } = route.params;

  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <View style={styles.container}>
      <WebView source={{ uri: mapUrl }} style={styles.map} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1,backgroundColor: theme.colors.background },
  map: { flex: 1 },
});

export default PropertyMapScreen;
