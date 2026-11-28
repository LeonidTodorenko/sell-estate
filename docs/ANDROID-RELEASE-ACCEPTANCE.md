# Android Normal и Admin · 30.9.2

Собирать из C:\App\InvestorApp\android. Существующий versionCode 15 сохранён. Версию самостоятельно не повышать.

Normal:
```powershell
$env:OWNERSCLUB_ADMIN_QA='0'
.\gradlew.bat :app:assembleInternalQa -PreactNativeArchitectures=arm64-v8a
```

Admin с безопасными тестовыми значениями:
```powershell
$env:OWNERSCLUB_ADMIN_QA='1'
.\gradlew.bat :app:assembleAdminQa -PreactNativeArchitectures=arm64-v8a
```

Результаты — app/build/outputs/apk/internalQa/app-arm64-v8a-internalQa.apk и app/build/outputs/apk/adminQa/app-arm64-v8a-adminQa.apk. Обе используют прежний debug.keystore. Коммерческая Release требует четыре OWNERSCLUB_RELEASE_* и постоянную подпись.

Исторический блок находится в src/screens/LoginScreen.tsx, quickLoginWrap. Локальный исходник пользователя сохраняется. safeLoginTransformer.js исключает блок из Normal и заменяет реквизиты Admin безопасными нерабочими значениями. Для авторизованной проверки пользователь вводит свои данные вручную. Не переносить локальные пароли в Git, документацию, карты исходников или APK.

API — https://sell-estate.onrender.com/api, системный HTTPS. Основной и debug манифесты запрещают cleartext. Quick Login fixture, отдельный вариант, localhost:7019 и его Metro-подмена удалены. adb reverse не требуется.

Hermes, minifyEnabled, shrinkResources и useLegacyPackaging=true соответствуют прежним внутренним сборкам. Внутренние варианты включают JS и работают автономно. Проверенный старый debug APK не содержит assets/index.android.bundle и требует Metro. Это объясняет непригодность debug APK для автономной выдачи. Причина конкретного вылета на физическом телефоне остаётся неподтверждённой до logcat.

Перед выдачей проверить apksigner verify --print-certs, ARM64 и assets/index.android.bundle в ZIP, размер, холодный запуск без Metro и QA-сервера. Не удалять данные приложения. Авторизованная проверка выполняется пользователем без изменения production данных.

Проверка 28.11.2026: обе сборки ARM64 содержат Hermes JS, только arm64-v8a, исходные локальные пароли отсутствуют. Normal — 21489409 байт, Admin — 21490021 байт. SHA-256 сертификата обеих и прежней тестовой APK: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c. На x86_64 эмуляторе обе прошли холодный запуск и открыли форму входа, Admin показал исторические кнопки с безопасными значениями. Metro и порт 7019 отсутствовали, adb reverse отсутствовал. Публичный API properties вернул HTTP 200. Вход пользователя не выполнялся.

Вылет установленной debug-сборки воспроизведён на эмуляторе: ReactHost/ReactNoCrashSoftException, Unable to load script. Встроенного JS в debug APK нет. Внутренние сборки устраняют этот воспроизведённый сбой. Проверка конкретного телефона отложена пользователем. Карты исходников внутренних сборок удаляются после упаковки, поскольку содержат локальный исходник.

C:\App\q9 и C:\App\m30 уже отсутствовали. Удалены только две устаревшие записи worktree, прочие рабочие каталоги сохранены.
