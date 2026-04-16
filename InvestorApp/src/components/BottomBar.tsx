import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, Text, StyleSheet, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { performLogout } from '../services/authLogout';
import theme from '../constants/theme';
import { navigationRef } from '../navigation/navigationRef';

export const BOTTOM_BAR_HEIGHT = 84;

// icons
import homeGreen from '../assets/images/home_green.png';
import homeGray from '../assets/images/home_gray.png';

import propertyGreen from '../assets/images/property_green.png';
import propertyGray from '../assets/images/property_gray.png';

import marketGreen from '../assets/images/market_green.png';
import marketGray from '../assets/images/market_gray.png';

import supportGreen from '../assets/images/support_green.png';
import supportGray from '../assets/images/support_gray.png';

import personalGreen from '../assets/images/personal_green.png';
import personalGray from '../assets/images/personal_gray.png';
 
import profileIcon from '../assets/images/DarkGradientUse/ID.png';
import historyIcon from '../assets/images/DarkGradientUse/History.png';
import statsIcon from '../assets/images/DarkGradientUse/port.png';
import withdrawIcon from '../assets/images/DarkGradientUse/dollar.png';
import logoutIcon from '../assets/images/DarkGradientUse/Logout.png';

type BtnProps = {
  label: string;
  iconActive?: any;
  iconInactive?: any;
  active?: boolean;
  onPress: () => void;
  isMore?: boolean;
};

const BTN = ({
  label,
  iconActive,
  iconInactive,
  active,
  onPress,
  isMore = false,
}: BtnProps) => (
  <Pressable style={styles.btn} onPress={onPress}>
    {isMore ? (
      <Text style={[styles.moreIcon, { color: active ? theme.colors.primary : theme.colors.textSecondary }]}>
        ⋯
      </Text>
    ) : (
      <Image
        source={active ? iconActive : iconInactive}
        style={styles.icon}
        resizeMode="contain"
      />
    )}

    <Text style={[styles.label, { color: active ? theme.colors.primary : theme.colors.textSecondary }]}>
      {label}
    </Text>
  </Pressable>
);

function safeNavigate(name: keyof RootStackParamList) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never);
  }
}

function safeResetToLogin() {
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'Login' as never }] });
  }
}

export default function BottomBar() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [routeName, setRouteName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!navigationRef) return;

    const update = () => {
      const r = navigationRef.getCurrentRoute();
      setRouteName(r?.name);
    };

    update();

    const unsub = navigationRef.addListener('state', update);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const bottomPad = Math.max(insets.bottom, 8);
  const barHeight = BOTTOM_BAR_HEIGHT + bottomPad;

  const isActive = useMemo(() => (name: string) => routeName === name, [routeName]);

  return (
    <>
      <View style={[styles.wrap, { paddingBottom: bottomPad, height: barHeight }]}>
        <BTN
          label=" "
          iconActive={homeGreen}
          iconInactive={homeGray}
          active={isActive('Home')}
          onPress={() => safeNavigate('Home')}
        />

        <BTN
          label=" "
          iconActive={propertyGreen}
          iconInactive={propertyGray}
          active={isActive('Properties')}
          onPress={() => safeNavigate('Properties')}
        />

        <BTN
          label=" "
          iconActive={marketGreen}
          iconInactive={marketGray}
          active={isActive('ShareMarketplaces')}
          onPress={() => safeNavigate('ShareMarketplaces')}
        />

        <BTN
          label=" "
          iconActive={supportGreen}
          iconInactive={supportGray}
          active={isActive('Chat')}
          onPress={() => safeNavigate('Chat')}
        />

         <BTN
          label=" "
          iconActive={personalGreen}
          iconInactive={personalGray}
          active={isActive('Profile')}
          onPress={() => safeNavigate('Profile')}
        />

        <BTN
          label="More"
          active={open}
          onPress={() => setOpen(true)}
          isMore
        />
      </View>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet} pointerEvents="box-none">
            <View style={styles.sheetBody}>
              
              
              
             {/* <Pressable style={styles.sheetItem} onPress={() => { setOpen(false); safeNavigate('Profile'); }}>
  <Image source={profileIcon} style={styles.sheetIcon} />
  <Text style={styles.sheetText}>Profile</Text>
</Pressable> */}

<Pressable style={styles.sheetItem} onPress={() => { setOpen(false); safeNavigate('MyInvestments'); }}>
  <Image source={historyIcon} style={styles.sheetIcon} />
  <Text style={styles.sheetText}>History</Text>
</Pressable>

<Pressable style={styles.sheetItem} onPress={() => { setOpen(false); safeNavigate('MyFinance'); }}>
  <Image source={statsIcon} style={styles.sheetIcon} />
  <Text style={styles.sheetText}>Statistics</Text>
</Pressable>

<Pressable style={styles.sheetItem} onPress={() => { setOpen(false); safeNavigate('Withdraw'); }}>
  <Image source={withdrawIcon} style={styles.sheetIcon} />
  <Text style={styles.sheetText}>Withdraw</Text>
</Pressable>

<View style={styles.divider} />

<Pressable
  style={styles.sheetItem}
  onPress={async () => {
    setOpen(false);
    await performLogout(() => safeResetToLogin());
  }}
>
  <Image source={logoutIcon} style={styles.sheetIcon} />
  <Text style={[styles.sheetText, { color: theme.colors.danger }]}>
    Logout
  </Text>
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
    left: 0,
    right: 0,
    bottom: 0,

    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing.sm,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
    zIndex: 100,
  },

  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingTop: 8,
    gap: 4,
  },

  icon: {
    width: 56,
    height: 56,
  },

  moreIcon: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
  },

  label: {
    fontSize: 11,
    fontWeight: '600',
  },

  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },

  sheet: {
    width: '100%',
  },

  sheetBody: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderTopLeftRadius: theme.radii.md,
    borderTopRightRadius: theme.radii.md,
  },
 
  sheetText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  sheetItem: {
  flexDirection: 'row',   // 🔥 ключевое
  alignItems: 'center',
  paddingVertical: 12,
},

sheetIcon: {
  width: 28,
  height: 28,
  marginRight: 12,
},
});