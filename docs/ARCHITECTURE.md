# Архитектура OwnersClub

[Состояние копии](CURRENT-STATE.md) · [Карта](CODE-MAP.md) · [Финансовые правила](BUSINESS-RULES.md)

## Backend

ASP.NET Core на .NET 8, EF Core 9 и Npgsql/PostgreSQL. [Program.cs](../RealEstateInvestment/Program.cs) регистрирует middleware, контроллеры и сервисы. [AppDbContext](../RealEstateInvestment/Data/AppDbContext.cs) связывает модели с БД. [Решение](../RealEstateInvestment.sln) включает серверные проекты. Для локальной сборки из корня используй `dotnet build RealEstateInvestment.sln`. Для тестов — `dotnet test RealEstateInvestment.Tests/RealEstateInvestment.Tests.csproj`. Интеграционные проверки с PostgreSQL запускай только с выделенной тестовой БД после проверки fixture и настроек подключения.

### Auth и JWT

[AuthController](../RealEstateInvestment/Controllers/AuthController.cs) выдаёт access/refresh, проверяет хеш refresh, ротирует его и обрабатывает logout. В текущем Program.cs включены проверка ключа подписи и срока действия, ClockSkew равен нулю, проверки issuer и audience отключены. Доступ дополнительно зависит от атрибутов и проверок роли/владельца на маршруте. Настройки работающего сервера требуют отдельного подтверждения.

### Gemini AI Assistant

[AssistantController](../RealEstateInvestment/Controllers/AssistantController.cs) — серверная точка входа. [AssistantRegistration](../RealEstateInvestment/Services/Assistant/AssistantRegistration.cs) подключает [GeminiFaqAdapter](../RealEstateInvestment/Services/Assistant/GeminiFaqAdapter.cs), учитывает флаги Enabled и FreeTierConfirmed и задаёт таймаут. [AssistantKnowledge](../RealEstateInvestment/Services/Assistant/AssistantKnowledge.cs) и [csproj](../RealEstateInvestment/RealEstateInvestment.csproj) связывают приложение с ресурсами знаний. Для персональных финансовых запросов контроллер использует [PersonalFinanceReader](../RealEstateInvestment/Services/Assistant/PersonalFinanceReader.cs). [Web-хук](../WebApp/src/use-assistant.ts) передаёт `sourceLinks` из ответа API на страницу ассистента. Клиентские входы — [RN](../InvestorApp/src/screens/AssistantScreen.tsx) и [Web](../WebApp/src/assistant-page.tsx).

### Развёртывание API

[Dockerfile](../Dockerfile) публикует сервер в Release в SDK-образе .NET 8 и запускает DLL в ASP.NET runtime. При старте API могут выполняться миграции (флаг `RunMigrationsOnStartup`) и инициализация системных данных. Фоновые задачи и миграции проверяются отдельно по окружению и сценарию выпуска. Для чтения документации запуск API не требуется.

## Mobile

React Native 0.82, React 19, TypeScript, React Navigation, Axios, Keychain. [sessionStorage.ts](../InvestorApp/src/services/sessionStorage.ts) нормализует и хранит сессию в Keychain. [api.ts](../InvestorApp/src/api.ts) проставляет токен, объединяет refresh после 401 и повторяет исходный запрос с ограничением повторов. При разборе миграции сессии проверь оставшиеся обращения к AsyncStorage.

В `InvestorApp` доступны `npm ci`, `npm run typecheck`, `npm test -- --runInBand`, `npm start` и `npm run android`. Для Android нужны JDK, Android SDK, эмулятор или устройство. Локальная debug-сборка — `.\gradlew.bat assembleDebug` из `InvestorApp/android`. Скрипты подготовки подписанного релиза проверяй по [Gradle](../InvestorApp/android/app/build.gradle) и [build-android-release.bat](../build-android-release.bat), включая пути и источник подписи.

## Web

React 19, React Router 7, TypeScript и Vite 7. В `WebApp` с Node ≥ 22.12 доступны `npm ci`, `npm run dev`, `npm run typecheck`, `npm test`, `npm run build` и `npm run preview`. Сборка выполняет проверку типов и создаёт `dist/`. `VITE_API_BASE_URL` задаётся с суффиксом `/api`. Смотри [README веб-клиента](../WebApp/README.md) и [.env.example](../WebApp/.env.example).

Для Cloudflare Workers Static Assets README описывает подготовленный `dist` и SPA fallback `single-page-application`. Не добавляй `_redirects` в этот пакет из-за описанного цикла перенаправлений. Проверь состав артефакта, заголовки из [public/_headers](../WebApp/public/_headers), CORS и прямой вход на вложенный маршрут. Это процедура из репозитория. Факт публикации и действующие настройки Cloudflare проверяются отдельно.
