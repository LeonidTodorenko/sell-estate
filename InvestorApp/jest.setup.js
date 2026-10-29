// Jest has no Android native services. Keep all external I/O isolated.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock'));
jest.mock('@react-native-firebase/messaging', () => ({__esModule: true, default: jest.fn(() => ({onMessage: jest.fn(() => jest.fn())}))}));
jest.mock('@notifee/react-native', () => ({__esModule: true, AndroidImportance: {HIGH: 4}, default: {createChannel: jest.fn(async () => 'default'), displayNotification: jest.fn(async () => undefined)}}));
jest.mock('react-native-keychain', () => ({getGenericPassword: jest.fn(async () => false), setGenericPassword: jest.fn(async () => true), resetGenericPassword: jest.fn(async () => true)}));

require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const axios = require('axios');
axios.defaults.adapter = async () => { throw new Error('Jest blocks external network I/O'); };
jest.mock('react-native-haptic-feedback', () => ({trigger: jest.fn()}));
jest.mock('react-native-image-picker', () => ({launchCamera: jest.fn(), launchImageLibrary: jest.fn()}));
jest.mock('@react-native-documents/picker', () => ({pick: jest.fn(), types: {pdf: 'application/pdf', allFiles: '*/*'}, isErrorWithCode: () => false}));
jest.mock('react-native-video', () => 'Video');
jest.mock('react-native-webview', () => ({WebView: 'WebView'}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

// Keep native animation/polling timers inside each test's lifetime.
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
