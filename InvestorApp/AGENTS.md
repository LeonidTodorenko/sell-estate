# OwnersClub InvestorApp

Прочитай [корневые инструкции](../AGENTS.md), выбери сценарий в [карте](../docs/CODE-MAP.md). Начни с экрана и [AppNavigator](src/navigation/AppNavigator.tsx), затем проверь [API-клиент](src/api.ts) и соответствующий серверный endpoint.

Для auth проследи [Login](src/screens/LoginScreen.tsx) → [Gate](src/screens/GateScreen.tsx) → [Keychain](src/services/sessionStorage.ts) → refresh/logout. Для Android-возврата открой [манифест](android/app/src/main/AndroidManifest.xml), AppNavigator, [TopUp](src/screens/TopUpScreen.tsx) и [AddFunds](src/screens/AddFunds.tsx). Проверяй холодный и тёплый запуск и переход после восстановления сессии. Для покупок сверяй поведение при повторе и смене пользователя. [Команды](../docs/ARCHITECTURE.md#mobile).
