// src/services/sessionStorage.ts
import * as Keychain from 'react-native-keychain';

const KEY = 'auth_session';

export type Session = {
  accessToken: string;
  refreshToken: string;
  user?: any;  
};

export async function saveSession(session: Session) {
    const payload = JSON.stringify(session);

      // 1) Пытаемся максимально безопасные настройки
  try {
    await Keychain.setGenericPassword(KEY, payload, {
      service: KEY,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
    });
    return;
  } catch (e1) {
    console.warn('[Keychain] SECURE_HARDWARE + BIOMETRY failed:', e1);
  }

   // 2) Ослабляем до программной крипты (без биометрии)
  try {
    await Keychain.setGenericPassword(KEY, payload, {
      service: KEY,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
      // accessControl убираем
    });
    return;
  } catch (e2) {
    console.warn('[Keychain] SECURE_SOFTWARE failed:', e2);
  }

  // 3) Последний фоллбек — ANY (лишь бы не падало)
  await Keychain.setGenericPassword(KEY, payload, {
    service: KEY,
    securityLevel: Keychain.SECURITY_LEVEL.ANY,
  });

  // await Keychain.setGenericPassword(KEY, JSON.stringify(session), {
  //   accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  //   accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE, // опционально: Face/Touch ID
  //   securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE, // где доступно
  //   service: KEY,
  // });
}

export async function loadSession(): Promise<Session | null> {
  const creds = await Keychain.getGenericPassword({ service: KEY });
  if (!creds) return null;
    try {
    return JSON.parse(creds.password) as Session;
  } catch {
    return null;
  }
}

export async function clearSession() {
   try {
    await Keychain.resetGenericPassword({ service: KEY });
  } catch (e) {
    console.warn('[Keychain] resetGenericPassword failed:', e);
  }
}
