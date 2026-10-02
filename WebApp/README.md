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
| `/profile` | Актуальные безопасные поля `/users/{id}`, аватар, KYC status, тип аккаунта и баланс |
| `/admin` | Read-only admin totals |
| `/admin/users`, `/admin/users/:id` | Поиск и safe metadata пользователей |
| `/admin/investments` | Read-only список инвестиций |
| `/admin/demo-accounts` | Read-only состояние sandbox-аккаунтов |
| `/admin/logs` | Фильтры и серверная пагинация action logs |

Внутренние страницы защищены auth gate. Предусмотрены loading, error/retry, empty и not-found states. Интерфейс на английском, как InvestorApp; суммы — USD. Тёмно-зелёные/нейтральные цвета с основным `#11A36A`; desktop sidebar и горизонтальная мобильная навигация.

Iteration 8 включает подачу инвестиционных заявок, buy/bid/create/cancel/extend предложений, профиль/аватар/пароль, KYC, inbox с отметкой прочтения, chat, историю и Demo Top Up. Финансовые операции требуют предварительного просмотра и PIN/пароля, POST не повторяется автоматически. Банковский вывод, production Top Up, platform buyback, accept bid и change price недоступны. Iteration 9 добавляет только read-only Admin Web v1 с шестью представлениями. Frontend role guard служит для UX; каждый admin GET авторизует backend. Demo никогда не допускается в `/admin`. Admin mutations, KYC review, withdrawals, properties, settings и сообщения не включены. Тестовые данные существуют только в тестах, production-сборка их не включает.

## Переиспользование и контракты

- `src/types.ts`: DTO адаптированы из `InvestorApp/src/services/properties.ts`, `HomeScreen`, `MyInvestmentsScreen`, `ShareMarketplaceScreen`, `UserTransactionsScreen`, `ProfileScreen` и сверены с ASP.NET controllers.
- `src/api.ts`: browser fetch вместо RN Axios/interceptors; Bearer JWT, timeout 45 s для Render cold start, один общий refresh promise, однократный retry при 401, logout, синхронизация вкладок.
- `src/session.ts`: адаптация `services/auth.ts`, `sessionStorage.ts` и `AuthContext`; поддержка `accessToken/token/jwt`, `refreshToken/refresh_token/refresh`, вложенного/плоского user id, Microsoft nameidentifier claim. Refresh сохраняет метаданные пользователя и проверяет неизменность identity/demo.
- JWT `isDemo` понимает boolean и строки `"true"`/`"false"`. JWT claim имеет приоритет перед UI metadata; затем используются поля ответа/session. Декодирование в браузере служит только для отображения и срока жизни, сервер проверяет подпись/доступ.
- Demo login использует тот же endpoint и выданные пользователю demo credentials. Не создаёт demo-аккаунт и не подставляет выдуманные учётные данные. У demo нет refresh token: по истечении JWT требуется повторный вход.
- Сессия хранится отдельно от mobile в localStorage: `ownersclub.web.session.v1`. Это browser persistence, не эквивалент RN Keychain/HttpOnly cookies. Никаких токенов в URL, логах или HTML.
- Profile читает SafeUserResponse из `/users/{id}`; секретных полей не ожидает. Iteration 7 поддерживает Demo и в `/auth/me`, однако профиль использует owner endpoint. JWT определяет контур данных.
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
| Admin overview / users / investments / demo / logs | GET `/admin/stats`, `/admin/users`, `/admin/users/{id}`, `/admin/investments`, `/admin/demo-accounts`, `/admin/stats/logs` |

## CORS: проверка окружения

См. `CORS-BLOCKER.md`: исходное наблюдение относится к 8 сентября. На 25 сентября локальный Program.cs уже разрешает `https://wamsoc.com`, `https://www.wamsoc.com` и `http://localhost:5173`, но не `http://127.0.0.1:5173`. Для локальных обращений к backend открывайте localhost:5173. Соответствие опубликованного Render локальному backend и реальный login E2E в Iteration 8 не проверялись. Browser smoke полностью перехватывает API; backend/CORS здесь не изменялись.

## Cloudflare static output

Обычный output — `dist/index.html` и `dist/assets/*`. Для Workers Static Assets следует настроить `assets.directory` на подготовленный release-каталог из `dist` и `assets.not_found_handling` на `single-page-application`. `_redirects` намеренно отсутствует: его нельзя добавлять в release package из-за известного redirect loop. Перед upload проверяется manifest сборки. `public/_headers` содержит базовые заголовки для static assets; при наличии Worker-generated responses заголовки нужно проверить отдельно. Никаких Workers, Cloudflare settings, DNS или доменов эта работа не меняла. Ничего не опубликовано.

## Проверки

Iteration 9: `npm run typecheck`, `npm test` (30 tests), `npm run build`, `admin-smoke.mjs` и регрессионный `investor-smoke.mjs`. Оба browser smoke используют только подставные API-ответы; admin suite отклоняет любой запрос кроме GET. Подробности: `C:\App\outputs\webapp-iteration-9-report.md`.

Iteration 8: семь browser suites (`smoke.mjs`, `activity-smoke.mjs`, `investor-smoke.mjs`, `community-smoke.mjs`, `onboarding-smoke.mjs`, `financial-smoke.mjs`, `iteration8-smoke.mjs`). Подробности: `C:\App\outputs\webapp-iteration-8-report.md`.

Ниже — исторические проверки первоначальной версии, не свежая проверка Render:

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

Основные файлы: `src/main.tsx` (маршруты, auth gate, layout), `src/pages.tsx` (экраны), `src/api.ts`, `src/session.ts`, `src/types.ts`, `src/ui.tsx` (loading/error/data hook), `src/format.ts`, `src/style.css`, `.env.example`, `public/_headers`, тесты и lockfile.
