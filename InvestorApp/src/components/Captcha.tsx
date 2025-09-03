import React from 'react';
import { WebView } from 'react-native-webview';
import { View, StyleSheet } from 'react-native';
import theme from '../constants/theme';

interface CaptchaProps {
  onVerify: (token: string) => void;
}
// todo разобраться с доменом для капчи гугла
const SITE_KEY = 'пока убрал';
const Captcha = ({ onVerify }: CaptchaProps) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
      </style>
      <script src="https://www.google.com/recaptcha/api.js"></script>
    </head>
    <body>
      <div class="g-recaptcha" data-sitekey="${SITE_KEY}" data-callback="onSuccess"></div>
      <script>
        function onSuccess(token) {
          window.ReactNativeWebView.postMessage(token);
        }
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        source={{ html }}
        onMessage={(event) => onVerify(event.nativeEvent.data)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 300,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default Captcha;
