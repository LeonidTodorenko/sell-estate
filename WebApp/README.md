# OwnersClub WebApp

Отдельный React + Vite + TypeScript web-клиент в `C:\App\WebApp`.
Backend, InvestorApp и существующий Next.js starter не изменены.

## Запуск

Требуется Node.js 22.12+ (рекомендуется 24 LTS; `.nvmrc` = 24). Системный Node 20.17 на этой машине недостаточен. Требование Vite: https://vite.dev/guide/.

```powershell
cd C:\App\WebApp
npm ci
Copy-Item .env.example .env
npm run dev -- --port 5173 --strictPort
```

API настраивается через `VITE_API_BASE_URL` в `.env`, включая суффикс `/api`.
По умолчанию: `https://sell-estate.onrender.com/api`, как в `InvestorApp/src/api.ts`.
Переменная публичная, подставляется при сборке; после изменения нужна новая сборка.
Секреты, логины и пароли в `.env` не размещать.

```powershell
npm run typecheck
npm test
npm run build
npm run preview -- --port 5173 --strictPort
```

`npm run dev` и preview доступны на `http://127.0.0.1:5173` с указанным портом.
Сборка: `C:\App\WebApp\dist`. Серверный runtime не требуется.

## Экраны

| URL | Возможности |
| --- | --- |
| `/` | Публичный landing, переход ко входу / demo-входу |
| `/login`, `/login?demo=1` | Вход через существующий `/auth/login`, ошибки, возврат на исходную страницу |
| `/dashboard` | Балансы, стоимость активов, текущий портфель |
| `/properties` | Каталог, поиск по названию/локации, тип листинга, доступные доли |
| `/properties/:id` | Описание, изображения, цена и стоимость доли, сроки, PDF при наличии |
| `/investments` | История инвестиций, минимальная сумма/число долей, сортировка по дате |
| `/marketplace` | Активные предложения, поиск, собственные предложения |
| `/transactions` | Операции, фильтр типа и диапазона дат |
| `/profile` | Данные текущей сессии, тип аккаунта, demo code и актуальный баланс |

Внутренние страницы защищены auth gate. Предусмотрены loading, error/retry, empty и not-found states. Интерфейс на английском, как InvestorApp; суммы — USD. Тёмно-зелёные/нейтральные цвета с основным `#11A36A`; desktop sidebar и горизонтальная мобильная навигация.

Первая версия включает просмотр инвестиций/предложений/профиля. Покупка, продажа, ставки, инвестиционные заявки, редактирование профиля, регистрация и восстановление пароля остаются в мобильном приложении. Admin/KYC/report screens не перенесены. Тестовые данные существуют только в тесте, production-сборка их не включает.

## Переиспользование и контракты

- `src/types.ts`: DTO адаптированы из `InvestorApp/src/services/properties.ts`, `HomeScreen`, `MyInvestmentsScreen`, `ShareMarketplaceScreen`, `UserTransactionsScreen`, `ProfileScreen` и сверены с ASP.NET controllers.
- `src/api.ts`: browser fetch вместо RN Axios/interceptors; Bearer JWT, timeout 45 s для Render cold start, один общий refresh promise, однократный retry при 401, logout, синхронизация вкладок.
- `src/session.ts`: адаптация `services/auth.ts`, `sessionStorage.ts` и `AuthContext`; поддержка `accessToken/token/jwt`, `refreshToken/refresh_token/refresh`, вложенного/плоского user id, Microsoft nameidentifier claim. Refresh сохраняет метаданные пользователя и проверяет неизменность identity/demo.
- JWT `isDemo` понимает boolean и строки `"true"`/`"false"`. JWT claim имеет приоритет перед UI metadata; затем используются поля ответа/session. Декодирование в браузере служит только для отображения и срока жизни, сервер проверяет подпись/доступ.
- Demo login использует тот же endpoint и выданные пользователю demo credentials. Не создаёт demo-аккаунт и не подставляет выдуманные учётные данные. У demo нет refresh token: по истечении JWT требуется повторный вход.
- Сессия хранится отдельно от mobile в localStorage: `ownersclub.web.session.v1`. Это browser persistence, не эквивалент RN Keychain/HttpOnly cookies. Никаких токенов в URL, логах или HTML.
- `/auth/me` не используется для Profile: в текущем backend он читает production Users и не обслуживает demo. Profile показывает безопасный набор полей из login session; баланс запрашивается отдельно. `/users/:id` намеренно не нужен для этого экрана.
- Property Details, как RN, ищет объект в `/properties`; не предполагает несуществующий detail endpoint. Изображения загружаются только для открытого объекта, без массовых дополнительных запросов каталога.
- Сортировка, фильтры, расчёт price / totalShares и формат USD перенесены без RN UI.

| Данные | Существующий API endpoint |
| --- | --- |
| Вход / обновление / выход | POST `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Балансы | GET `/users/{userId}/total-assets` |
| Портфель | GET `/investments/with-aggregated/{userId}` |
| Каталог / изображения | GET `/properties`, `/properties/{id}/images` |
| История инвестиций | GET `/investments/user/{userId}` |
| Предложения | GET `/share-offers/active` |
| Транзакции | GET `/users/transactions/user/{userId}` |

## CORS: текущий blocker

См. `CORS-BLOCKER.md`. Прямые browser fetch с локального origin и будущего `wamsoc.com` сейчас блокируются. Backend не изменялся. Поэтому реальный вход и проверка приватных данных end-to-end не завершены. Для них после разрешения origin нужны действительные credentials. Нет dev proxy, который скрывал бы production-проблему.

## Cloudflare static output

Обычный `dist/index.html` и `dist/assets/*`. `public/_redirects` попадает в dist и задаёт SPA fallback для Cloudflare Pages (`/* /index.html 200`). Для будущего Workers Static Assets следует отдельно настроить `assets.directory` на dist и `assets.not_found_handling` на `single-page-application`; Pages `_redirects` не заменяет настройку Worker. `public/_headers` содержит базовые заголовки для Pages; при Worker нужно проверить их поддержку отдельно. Никаких Workers, Cloudflare settings, DNS или доменов эта работа не меняла. Ничего не опубликовано.

## Проверки

- `npm install`: завершён, первоначальное предупреждение о системном Node 20.17.
- После остановки preview выполнен повторный `npm ci` на Node 24.19.0: успешно, audit 0 vulnerabilities. Первая попытка ci во время работающего preview упёрлась в Windows file lock; устранено остановкой preview.
- `npm run build` / TypeScript strict: успешно. Vite 7.3.6; только сообщения об игнорировании React Router `use client` в SPA bundle.
- `npm test`: 5 тестов session/JWT — успешно.
- ESLint в новом проекте не настроен; не добавлялся отдельный lint stack. Статическая проверка: TypeScript strict + noUnusedLocals/noUnusedParameters.
- `tests/smoke.mjs`: headless Edge, контролируемые API-ответы. Landing, gate/deep links, ошибка login, session persistence, все экраны, фильтры, not-found, API error/retry/empty, concurrent refresh, logout, demo expiry, повреждённое хранилище, повторный 401, sign-out между вкладками. Семь мобильных маршрутов проверены на 390 px; desktop — 1440 px. Это тест интерфейса/контрактов, не подтверждение работы приватного Render API.
- Реальный Edge fetch `/properties` из `http://127.0.0.1:5173` подтверждает CORS-блокировку.

Browser smoke требует Playwright в отдельной tooling-папке и установленный Edge (production-зависимости не увеличены):

```powershell
$env:PLAYWRIGHT_MODULE = 'C:\path\to\tooling\node_modules\playwright'
$env:SMOKE_BASE_URL = 'http://127.0.0.1:5173'
node tests/smoke.mjs
```

Основные файлы: `src/main.tsx` (маршруты, auth gate, layout), `src/pages.tsx` (экраны), `src/api.ts`, `src/session.ts`, `src/types.ts`, `src/ui.tsx` (loading/error/data hook), `src/format.ts`, `src/style.css`, `.env.example`, `public/_redirects`, тесты и lockfile.
