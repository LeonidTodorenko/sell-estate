// src/services/sessionStorage.ts
import * as Keychain from 'react-native-keychain';

const KEY = 'auth_session';

export type Session = {
  accessToken: string;
  refreshToken: string;
  user?: any;  
};

export async function saveSession(session: Session) {
  await Keychain.setGenericPassword(KEY, JSON.stringify(session), {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE, // опционально: Face/Touch ID
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE, // где доступно
    service: KEY,
  });
}

export async function loadSession(): Promise<Session | null> {
  const creds = await Keychain.getGenericPassword({ service: KEY });
  if (!creds) return null;
  return JSON.parse(creds.password) as Session;
}

export async function clearSession() {
  await Keychain.resetGenericPassword({ service: KEY });
}
