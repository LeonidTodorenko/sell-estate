import React, { useState } from 'react';
import { View, Pressable, Text, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { performLogout } from '../services/authLogout';

const BTN = ({ label, emoji, onPress }: { label: string; emoji: string; onPress: () => void }) => (
  <Pressable style={styles.btn} onPress={onPress}>
    <Text style={styles.emoji}>{emoji}</Text>
    <Text style={styles.label}>{label}</Text>
  </Pressable>
);

export const BOTTOM_BAR_HEIGHT = 64;

export default function BottomBar() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [open, setOpen] = useState(false);

  return (
    <>
      <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <BTN label="Home"     emoji="🏠" onPress={() => nav.navigate('Home')} />
        <BTN label="Property" emoji="🔍" onPress={() => nav.navigate('Properties')} />
        <BTN label="Market"   emoji="🛒" onPress={() => nav.navigate('ShareMarketplaces')} />
        <BTN label="Chat"     emoji="🎧" onPress={() => nav.navigate('Chat')} />
        <BTN label="More"     emoji="⋯"  onPress={() => setOpen(true)} />
      </View>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet} pointerEvents="box-none">
            <View style={styles.sheetBody}>
              {/* добавь тут любые удобные ярлыки */}
              <Pressable style={styles.sheetItem} onPress={() => { setOpen(false); nav.navigate('Profile'); }}>
                <Text style={styles.sheetText}>👤 Profile</Text>
              </Pressable>
              <Pressable style={styles.sheetItem} onPress={() => { setOpen(false); nav.navigate('MyInvestments'); }}>
                <Text style={styles.sheetText}>📈 My Investments</Text>
              </Pressable>
              <Pressable style={styles.sheetItem} onPress={() => { setOpen(false); nav.navigate('MyFinance'); }}>
                <Text style={styles.sheetText}>💼 My Finance</Text>
              </Pressable>
              <Pressable style={styles.sheetItem} onPress={() => { setOpen(false); nav.navigate('Withdraw'); }}>
                <Text style={styles.sheetText}>🏦 Withdraw</Text>
              </Pressable>

          <Pressable
                style={styles.sheetItem}
                onPress={async () => {
                  setOpen(false);
                  await performLogout(() =>
                    nav.reset({ index: 0, routes: [{ name: 'Login' }] })
                  );
                }}
              >
                <Text style={[styles.sheetText, { color: 'red' }]}>🚪 Logout</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: BOTTOM_BAR_HEIGHT,
    backgroundColor: 'white',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  btn: { alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 56, marginTop:15 },
  emoji: { fontSize: 20 },
  label: { fontSize: 11 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  sheetBody: {
    backgroundColor: '#fff',
    padding: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  sheetItem: { paddingVertical: 10 },
  sheetText: { fontSize: 16 },
});
