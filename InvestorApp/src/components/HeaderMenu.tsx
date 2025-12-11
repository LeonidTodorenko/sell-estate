// src/components/HeaderMenu.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from 'react-native';

const HeaderMenu: React.FC = () => {
  const [visible, setVisible] = useState(false);

  const onSelect = (item: string) => {
    setVisible(false);

     if (item === 'ABOUT') {
            Alert.alert(
            "ABOUT US",
            "Sell-Estate is a next-generation fractional real estate platform.\n\n" +
            "• Invest from $100\n" +
            "• Receive rental income\n" +
            "• Trade your shares anytime\n"
            );
        }

        if (item === 'VISION') {
            Alert.alert(
            "VISION",
            "Our vision:\n" +
            "• Make real estate investing accessible for everyone\n" +
            "• Build global investment opportunities\n" +
            "• Empower users with transparent financial tools"
            );
        }

        if (item === 'CONTACTS') {
            Alert.alert(
            "CONTACTS",
            "You can reach us:\n\n" +
            "Email: support@sell-estate.com\n" +
            "Phone: +971 55 123 4567\n" +
            "Address: Dubai, Business Bay, Tower 3\n"
            );
        }

    
  };

  return (
    <>
      {/* Кнопка-бургер в хедере */}
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.button}>
        <View style={styles.burger}>
          <View style={styles.line} />
          <View style={styles.line} />
          <View style={styles.line} />
        </View>
      </TouchableOpacity>

      {/* Выпадающее меню поверх экрана */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        {/* Нажатие по фону закрывает меню */}
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.menu}>
            <Pressable onPress={() => onSelect('ABOUT')} style={styles.menuItem}>
              <Text style={styles.menuText}>ABOUT</Text>
            </Pressable>
            <Pressable onPress={() => onSelect('VISION')} style={styles.menuItem}>
              <Text style={styles.menuText}>VISION</Text>
            </Pressable>
            <Pressable onPress={() => onSelect('CONTACTS')} style={styles.menuItem}>
              <Text style={styles.menuText}>CONTACTS</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  burger: {
    width: 22,
    height: 16,
    justifyContent: 'space-between',
  },
  line: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#2a1602',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menu: {
    marginTop: 50,           // отступ от верхнего края (под статусбар/хедер)
    marginRight: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 6,
    minWidth: 160,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default HeaderMenu;
