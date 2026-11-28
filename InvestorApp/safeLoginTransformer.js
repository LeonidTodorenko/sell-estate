const transformer = require('@react-native/metro-babel-transformer');

// Preserve the local historical screen. APKs receive only safe test values.
module.exports.transform = function (input) {
  if (input.filename.replace(/\\/g, '/').endsWith('src/screens/LoginScreen.tsx')) {
    const start = input.src.indexOf('<View style={styles.quickLoginWrap}>');
    const end = input.src.indexOf('</View>', start);
    if (start < 0 || end < 0) {
      throw new Error('Historical login block boundaries changed. Review APK sanitization.');
    }
    const block = input.src.slice(start, end + 7);
    const safeBlock = process.env.OWNERSCLUB_ADMIN_QA === '1'
      ? block.replace(/email:\s*(['"])[^'"]*\1/g, "email: 'android-test@example.invalid'")
          .replace(/password:\s*(['"])[^'"]*\1/g, "password: 'local-test-only'")
      : '';
    input = {...input, src: input.src.slice(0, start) + safeBlock + input.src.slice(end + 7)};
  }
  if (input.filename.replace(/\\/g, '/').endsWith('src/screens/LoginScreen.tsx')) {
    input = {...input, src: input.src
      .replace(/email:\s*(['"])[^'"]*\1/g, "email: 'android-test@example.invalid'")
      .replace(/password:\s*(['"])[^'"]*\1/g, "password: 'local-test-only'")};
  }
  return transformer.transform(input);
};
