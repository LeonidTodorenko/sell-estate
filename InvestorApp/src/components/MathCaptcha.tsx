import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import api from '../api';
import StyledInput from '../components/StyledInput';

const MathCaptcha = ({ onSuccess }: { onSuccess: () => void }) => {
  const [expression, setExpression] = useState('');
  const [captchaId, setCaptchaId] = useState<string>('');
  const [answer, setAnswer] = useState('');

  const loadCaptcha = async () => {
    try {
      const res = await api.get('/captcha/generate');
      setExpression(res.data.expression);
      setCaptchaId(res.data.id);
      setAnswer('');
    } catch {
      Alert.alert('Error', 'Failed to load captcha');
    }
  };

  const verifyCaptcha = async () => {
    try {
      const res = await api.post('/captcha/verify', {
        id: captchaId,
        answer: parseInt(answer),
      });
      if (res.data.success) {
        onSuccess();
      } else {
        Alert.alert('Wrong answer', 'Try again');
        loadCaptcha();
      }
    } catch {
      Alert.alert('Error', 'Verification failed');
      loadCaptcha();
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Solve: </Text>
        <Text style={styles.expression}>{expression}</Text>
        <Button title="🔁" onPress={loadCaptcha} />
      </View>
      <StyledInput
        value={answer}
        onChangeText={setAnswer}
        keyboardType="numeric"
        style={styles.input}
        placeholder="Your answer"
      />
      <Button title="Verify" onPress={verifyCaptcha} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 18 },
  expression: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
    padding: 8,
    borderRadius: 4,
  },
});

export default MathCaptcha;
