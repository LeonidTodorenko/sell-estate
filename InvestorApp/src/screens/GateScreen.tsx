import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { loadSession, saveSession, clearSession } from '../services/sessionStorage';
import api, { tryRefresh, setAccessToken, writeLegacyUser } from '../api';
import { ensureUserInSession } from '../services/ensureUser';
import { getRoleFromUserAndToken } from '../services/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Gate'>;

export default function GateScreen({ navigation }: Props) {
  useEffect(() => {
    (async () => {

      const safeExit = async () => {
        await clearSession();
        setAccessToken(null);
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      };

      try {
        const stored = await loadSession();

        // Нет сессии → на логин
        if (!stored?.accessToken) {
          return safeExit();
        }
 

       // попробуем рефреш (может access уже протух)
        const refreshed = stored.refreshToken
          ? await tryRefresh().catch(() => null)
          : null;
        const effective = refreshed ? { ...stored, ...refreshed } : stored;

        if (!effective?.accessToken) {
          return safeExit();
        }

        //  уже сейчас подставляем **актуальный** access в axios
         setAccessToken(stored.accessToken);

           // Проверяем токен реальным запросом  
        try {
          await api.get('/auth/me');
        } catch (err: any) {
            console.error(err);
          if (err?.response?.status === 401) {
            return safeExit();
          }
          // любая другая ошибка сети -> тоже безопасно выходим
          return safeExit();
        }

        const me = await ensureUserInSession();
        const isDemo = stored.isDemo === true || stored.user?.isDemo === true || me?.isDemo === true;
        const demoCode = stored.demoCode ?? stored.user?.demoCode ?? me?.demoCode ?? null;
        const sessionUser = { ...stored.user, ...me, isDemo, demoCode };

        // 5) Перезаписываем сессию на диске с новыми токенами и user
        await saveSession({ ...effective, isDemo, demoCode, user: sessionUser });

        // 6) Синхронизируем legacy-хранилище полноценным объектом (с user)
        await writeLegacyUser({ ...effective, isDemo, demoCode, user: sessionUser });

            
       // Токен рабочий — фиксируем сессию и летим по роли
         // 1) Обновим axios runtime токен
        //setAccessToken(effective.accessToken);
             // 2) Перезапишем сессию на диске (если был refresh)
        //await saveSession(effective);
           // 3) VERY IMPORTANT: синхронизируем legacy AsyncStorage ('user')
        //await writeLegacyUser(effective);

        //const role = effective.user?.role ?? effective.user?.Role ?? 'user';
        const role = getRoleFromUserAndToken(sessionUser, effective.accessToken);
        navigation.reset({
          index: 0,
          routes: [{ name: role === 'admin' ? 'AdminDashboards' : 'Home' } as any],
        });

      
      } catch(err: any)  {

        console.error(err);

          // Если явно 401 → logout
        if (err?.response?.status === 401) {
          await clearSession();
          setAccessToken(null);
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          return;
        }
        // Любая ошибка → безопасный выход на логин
        await clearSession();
        setAccessToken(null);
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    })();
  }, [navigation]);

  return (
    <View style={styles.c}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
