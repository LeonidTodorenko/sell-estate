import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
} as const;

type HapticType =
  | 'notificationSuccess'
  | 'notificationError'
  | 'notificationWarning'
  | 'selection'
  | 'impactLight';

const triggerSafely = (type: HapticType) => {
  try {
    ReactNativeHapticFeedback.trigger(type, options);
  } catch (error) {
    console.warn(`[HapticsService] Failed to trigger ${type}`, error);
  }
};

const Haptics = {
  success: () => triggerSafely('notificationSuccess'),
  error: () => triggerSafely('notificationError'),
  warning: () => triggerSafely('notificationWarning'),
  selection: () => triggerSafely('selection'),
  light: () => triggerSafely('impactLight'),
};

export const success = Haptics.success;
export const error = Haptics.error;
export const warning = Haptics.warning;
export const selection = Haptics.selection;
export const light = Haptics.light;

export default Haptics;
