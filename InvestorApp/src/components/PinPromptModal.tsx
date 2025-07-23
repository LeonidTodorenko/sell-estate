import React from 'react';
import { Modal, View, Text, TextInput, Button, StyleSheet } from 'react-native';

type PinPromptModalProps = {
  visible: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  pin: string;
  setPin: (value: string) => void;
};

const PinPromptModal: React.FC<PinPromptModalProps> = ({ visible, onSubmit, onCancel, pin, setPin }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>Enter PIN or Password</Text>
        <TextInput
          style={styles.input}
          placeholder="PIN or Password"
          secureTextEntry
          value={pin}
          onChangeText={setPin}
        />
        <Button title="Submit" onPress={onSubmit} />
        <View style={{ height: 10 }} />
        <Button title="Cancel" onPress={onCancel} />
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: 'white', padding: 20, borderRadius: 8, width: '80%' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, marginBottom: 10 },
});

export default PinPromptModal;
