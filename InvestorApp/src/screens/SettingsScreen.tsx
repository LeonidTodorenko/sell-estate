import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import theme from '../constants/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

import rightIcon from '../assets/images/kyc_right_m.png';
import bellIcon from '../assets/images/setting_Button_icon_bell.png';
import lockIcon from '../assets/images/setting_Button_icon_lock.png';

const SettingsScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  return (
    <View style={styles.screen}>
      {/* <View style={styles.topHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>

        <Text style={styles.topHeaderTitle}>Settings</Text>

        <View style={styles.backButtonPlaceholder} />
      </View> */}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.iconCircle}>
                <Image source={bellIcon} style={styles.rowIcon} resizeMode="contain" />
              </View>

              <Text style={styles.rowTitle}>Notifications</Text>
            </View>

            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#D9D9D9', true: '#A8DDC8' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D9D9D9"
            />
          </View>

          <View style={styles.divider} />

          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('About')}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircle}>
                <Image source={lockIcon} style={styles.rowIcon} resizeMode="contain" />
              </View>

              <Text style={styles.rowTitle}>Confidentiality</Text>
            </View>

            <Image source={rightIcon} style={styles.rightArrow} resizeMode="contain" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  topHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonPlaceholder: {
    width: 36,
    height: 36,
  },

  backArrow: {
    fontSize: 28,
    lineHeight: 28,
    color: theme.colors.text,
  },

  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },

  content: {
    padding: theme.spacing.lg,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F1F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  rowIcon: {
    width: 22,
    height: 22,
  },

  rowTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.text,
  },

  divider: {
    height: 1,
    backgroundColor: '#ECECEC',
    marginLeft: 62,
  },

  rightArrow: {
    width: 12,
    height: 16,
    tintColor: '#A3A3A3',
  },
});