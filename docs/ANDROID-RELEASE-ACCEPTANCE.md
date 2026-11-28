# Android internalQa · 30.9.2

Из C:\App\InvestorApp\android выполнить одну команду:

```powershell
.\gradlew.bat :app:assembleInternalQa -PreactNativeArchitectures=arm64-v8a
```

APK — C:\App\InvestorApp\android\app\build\outputs\apk\internalQa\app-arm64-v8a-internalQa.apk.

Единственный внутренний вариант internalQa наследует release, использует прежний android/app/debug.keystore, Hermes, встроенный assets/index.android.bundle, R8/minifyEnabled, shrinkResources и useLegacyPackaging=true. Команда ограничивает ABI значением arm64-v8a. Версия 30.9.2, существующий versionCode 15 сохранён.

API — https://sell-estate.onrender.com/api. В main/debug манифестах cleartext запрещён, используется системная проверка HTTPS. Metro, QA-сервер и adb reverse для запуска APK не требуются.

LoginScreen.tsx собирается в текущем локальном виде. Исторический блок быстрого входа находится в InvestorApp/src/screens/LoginScreen.tsx, quickLoginWrap. Пользователь самостоятельно управляет его наличием и реквизитами перед сборкой. Автоматической подмены значений и отдельного варианта Admin нет. Локальные пароли не добавлять в Git, инструкции или журналы. APK содержит значения из локального исходника, поэтому распространять его с учётом включённых реквизитов.

Официальный release сохранён отдельно. Он требует OWNERSCLUB_RELEASE_STORE_FILE, OWNERSCLUB_RELEASE_STORE_PASSWORD, OWNERSCLUB_RELEASE_KEY_ALIAS, OWNERSCLUB_RELEASE_KEY_PASSWORD и постоянную коммерческую подпись. Перед коммерческой сборкой пользователь должен подготовить LoginScreen.tsx без тестовых реквизитов и блока быстрого входа.

Ранее debug APK на эмуляторе воспроизводил Unable to load script из-за отсутствующего JS bundle. Предыдущие внутренние сборки прошли автономный холодный запуск, экран входа, гостевой каталог, проверку Hermes/ARM64 и прежней подписи. Пользователь подтвердил работу приложения на физическом телефоне. После текущего упрощения APK по указанию пользователя не пересобиралась.

Для следующей проверки — apksigner verify --print-certs, ABI arm64-v8a, assets/index.android.bundle, фактический размер и холодный запуск без Metro. Не удалять данные приложения. Не менять подпись, сборку, авторизацию и инфраструктуру без согласования. Не создавать временные копии репозитория.
