# Состояние релиза OwnersClub 30.8.5

Статическая сверка выполнена 24 ноября 2026 года по `main` на коммите `aa9c9816dd6991022f1d2853efb55ac4d7de74c9`. Это база документации. В неё входят Android-коммит 30.8.5 `7e59bbd6205a6a7cb470263ec1b940ec08cae15f` и последующие изменения диагностики входа и фильтрации ответов Gemini в `7551520717a585f29e60b5db832aa45227473a2e`.

- В [Gradle](../InvestorApp/android/app/build.gradle) установлены `versionName = 30.8.5` и `versionCode = 11`. Вариант `internalQa` получает суффикс `-normal`. [Заметки 30.8.5](OwnersClub-30.8.5.md) описывают также отдельный APK Quick Login для внутреннего тестирования.
- [AssistantController](../RealEstateInvestment/Controllers/AssistantController.cs) передаёт персональные финансовые запросы в [PersonalFinanceReader](../RealEstateInvestment/Services/Assistant/PersonalFinanceReader.cs), который читает данные аккаунта из серверного контекста пользователя. Расчёт покупки доступен без создания операции. Для общего чата см. [Gemini и источники ответов](ARCHITECTURE.md#gemini-ai-assistant).
- Маршруты KYC, покупки долей, платежей и восстановления RN-сессии приведены в [карте исходников](CODE-MAP.md). Правила владения, резерва и зачисления описаны в [правилах операций](BUSINESS-RULES.md).

По отчёту предыдущей Git-приёмки повторный прогон в копии разработки дал 427 PASS / 57 SKIP для API с отключёнными внешними интеграциями, 51 PASS для WebApp и 48 PASS для RN. При подготовке документации проверены исходники, связанные тесты и ссылки. Новый прогон приложений и сборка APK не выполнялись. Состояние production, установленный APK, миграции и вызовы Gemini или платёжного провайдера этой сверкой не подтверждены.

## Передача разработки Investment Planner

27 ноября 2026 года. [Исходный диалог](chatgpt-conversation://6b057cf5-60e4-83eb-a231-4cb4d2b37bab). AI Assistant и Android-вход подтверждены пользователем. Фокус итерации — сценарный серверный прогноз и контракт для графиков. В исходной версии AI Assistant уже рассчитывал параметры первичной покупки и показывал график платежей по объекту. Административный прогноз денежных потоков использует отдельный маршрут.

Официальный `main` на GitHub и `C:\Data\sell_estate\sell-estate` совпали на `3a9ae500893c35cafc864c64a40948f7558fc8cd`. Копия разработки `C:\App` на `bd050b3314acce409fafc27228db5b8bc8ba6d09`. Разница коммитов относится к архиву и его инструкциям. Предыдущие локальные изменения сохранены.

Добавлен [контракт сценарного прогноза](BUSINESS-RULES.md#сценарный-прогноз-investment-planner). Публикация и развёртывание ожидают согласования. Следующая итерация — отобразить типизированные ряды оценки и денежного потока в WebApp/Android и передавать те же серверные данные в структурированный ответ ассистента.

Проверка в `C:\App` с выделенной сборкой и временной SQLite. Целевой прогон InvestmentForecast, InvestmentWorkflow304, Assistant3071 и ScheduledApplication — 44 пройдено, 4 пропущено без PostgreSQL. Проверка рабочего окружения и вызов Gemini не входили в прогон.
Отдельный прогон FinancialEndpoint — 146 пройдено. Проверенный набор перенесён в основной репозиторий рабочими файлами.

### WebApp · графики в карточке объекта

27 ноября 2026 года. [Investment Planner](../WebApp/src/investment-planner.tsx) использует schemaVersion 1 с дискретными точками 0/1/3/5/10. Горизонт переключается локально. Число долей, условные ставки и предполагаемая дата начала аренды отправляются в API прогноза. Цена предложения и полная стоимость покупки получены из API. Сохранённая оценка долей и нереализованное изменение показаны отдельно. Основной график показывает базовый и оптимистичный сценарии, а стресс доступен в «Risks & assumptions». Карточка объекта сохраняет отдельную ссылку на Payment Plan. Сохранённая цена выкупа получена через `GET /api/properties/{id}/buyback-price`. Выкуп в текущем WebApp недоступен.

На отдельной арендной шкале видны предполагаемая дата начала, статус на каждой дискретной дате и настроенная месячная сумма по объекту. `netRent` schemaVersion 1 считает её валовой и вычитает расходы. Ручная выплата по умолчанию берёт `MonthlyRentalIncome` как сумму к распределению до клубной комиссии, а фактический допуск зависит от статуса `rented` и завершённого PaymentPlan. Денежные ряды аренды и корпоративных этапов исключены из Planner. Схема и серверные формулы сохранены.

Проверки в `C:\App`. Сборка WebApp, 55 тестов WebApp и 3 теста InvestmentForecast прошли. Edge со сценариями API проверен при 1440/390/320 CSS px. Отдельная совместная проверка отправила два авторизованных запроса из сборки WebApp в реальный ForecastController с синтетической SQLite в памяти. Остальные маршруты в этой проверке заменены фикстурами. Production и денежные операции вне проверки.

## Начисление аренды

27 ноября 2026 года. Оба ручных маршрута выполняют одну операцию. Допуск, база суммы и расчёт описаны в [правилах аренды](BUSINESS-RULES.md#аренда). История Android и WebApp по-прежнему доступна через `GET /api/users/me/rent-income-history`. Существующий 30-дневный отсчёт может применяться от даты создания новой карточки, поскольку это начальное значение `LastPayoutDate`.

Новая арендная квартира подготовлена в изолированном тестовом сценарии на базе существующей синтетической карточки. У неё отдельный ID, статус rented, завершённый план, цена $1 000 за долю и по одной доле у двух синтетических инвесторов.

## Ближайшая итерация AI и Planner

Следующий этап (Medium) требует согласования серверного контракта аренды. Определить источник, семантику суммы до комиссии и отдельные поля для неизвестных условий. Согласовать дату и условие первого начисления, долю от `TotalShares`, комиссию и обработку расходов. Добавить расчёт на сервере и тесты для дат до начала, неизвестных данных и отсутствия повторного вычета расходов. Затем передавать типизированные ряды и метаданные в структурированный ответ AI Assistant. Модель объясняет данные сервера, а клиент использует существующие компоненты графика и шкалы.

## AI Investment Intelligence

WebApp uses the conditional rental series in the Planner and in AI Assistant. The server returns explanatory text and a typed chart. Horizon changes are local. Assumption edits use the calculator without invoking Gemini.

Isolated browser fixtures use $1,000 per share and illustrative +6%/+10%. [DLD Real Estate Data](https://dubailand.gov.ae/en/open-data/real-estate-data/) offers historical transactions filtered by dates, district and property type, with CSV export from an interactive form. It directs users to Dubai Pulse for previous years. A future monthly aggregate should use a consistent cohort of registered sales and report the period, district, type, sample count, currency and calculation method. No real figures are configured. The read-only `GET /api/assistant/dubai-market` serves a manually approved aggregate from `Assistant:DubaiMarket:ApprovedSnapshot` when supplied by deployment configuration. It validates metadata and returns `no_data` for missing or malformed records. It marks the observation stale after 31 days from the observation end or approval date. The endpoint never fetches the DLD site or uses Gemini.

Property and global approvals are managed in WebApp administration. The historical Dubai answer is available in chat and via the read-only endpoint. Approved snapshots are cached for 15 minutes and invalidated when configuration reloads or UTC day changes. A direct market import and real observations remain unconfigured.

WebApp chat renders interactive cards from `POST /api/assistant/ask`. Examples include “Show a forecast for Marina Residence, 2 shares, 5 years”, “Make it 4 shares and 7 years”, “With rent from 2027-01-01 and fee 10%”, “Compare Marina Residence and Creek Residence”, “Recommend properties with budget 1000”, and “Dubai market”. The bounded English/Russian parser recognizes catalog display names. Ask for assumptions when an approval is unavailable (example “rates -10 0 0”). The property link prefills the composer. Chat context lasts up to 30 minutes for the current authenticated session. A different property clears rental start and fee. The tool reads the live catalog and does not call Gemini. Demo rises only in explicit isolated fixtures.

## AI Everywhere

27 November 2026. Local development at `bd050b3`; Git acceptance baseline and GitHub main at `3a9ae50`.

- The Web and Android chat cards share the server forecast DTO, with the requested horizon selected in each new card. The Demo chat keeps stress under Risk. Other cards show the full scenario set. Upfront cost is separate from the saved-valuation baseline. Approved rates carry scope, source and date. Missing current approvals return `no_data`.
- Web property insights provide a one-share forecast from approved inputs and links into Assistant. Web overview and portfolio show recorded balance and concentration by confirmed invested cost. Android adds on-demand read-only property and portfolio insights.
- Demo report commentary compares consecutive saved snapshots and states when the prior period is unavailable. The regular report email can describe ledger activity and recorded rent for its period. The regular client report history remains unavailable.
- Recommendations screen against available one-share catalog offers and the lesser of the requested budget and wallet balance. Already-held properties can appear with an explanation of added exposure.
- The final assistant and forecast regression run passed 114 tests. Two PostgreSQL tests and one live Gemini test were skipped. The WebApp build and 56 tests passed. Edge checked chat, property and portfolio insights, and Demo report commentary at 320, 390 and 1440 px. Those endpoints used the isolated loopback API with SQLite and synthetic data. Catalog and investment workflow responses were mocked. Android TypeScript, 48 Jest tests and the x86_64 debug build passed. The Android emulator exercised the real UI components with captured local API responses replayed by a fixture, including horizon selection, Demo stress expansion, property insights and report commentary. No production actions were taken.
- End-to-end Android verification against the real local API and Quick Login remains open. No real market data has been loaded. Regular monthly report work covers email commentary. The customer report history remains unavailable. See the [final acceptance handoff](CHAT-HISTORY-HANDOFF.md#next-package--work-medium).

## Приёмка интерфейсов кандидата 30.8.5

27 ноября 2026 года. WebApp показывает интерактивные кольца на главной, в портфеле, в AI Assistant, в Investment Planner при наличии обоих модельных компонентов и в месячных Demo-отчётах. Android показывает кольца на главной, в портфеле, в AI Assistant и Demo-отчётах. В карточке прогноза на Android есть значения по датам и состав модельного результата при заданных условиях аренды. Суммы отдаются в USD. Отрицательные суммы видны отдельно, начисленная на кошелёк аренда учитывается один раз.

Запрос о составе активов обрабатывается авторизованным локальным финансовым маршрутом AI Assistant по данным JWT-владельца. Gemini при этом не вызывается. Edge проверен на 1440, 390 и 320 CSS px с локальным API и синтетической PostgreSQL, включая обычный вход, диалог RU/EN, уточнение 4 долей и 7 лет, Planner и Demo-отчёт. Широкий серверный прогон: 443 прошли, 57 пропущены. Целевой прогон с PostgreSQL: 117 прошли, пропущен один живой Gemini. WebApp: сборка и 56 тестов. Android: TypeScript, 48 тестов, два самостоятельных ARM64 APK, установка на эмулятор. На эмуляторе проверены Quick Login через тестовый маршрут, авторизованные данные портфеля и кольцо в чате. Обычная форма входа прошла через локальный AuthController в QA-сборке. Отдельный APK Normal открыл обычную форму входа в офлайн-проверке.

APK с версией из Gradle имеют статус кандидатов для внутренней проверки. Для релиза нужны отдельное согласование, сверка версии и подписи, проверка совместимости API и приёмка на физическом устройстве. Обычные отчёты в WebApp остаются частичными, доставка письма в этой итерации не проверялась. Рабочая БД и зашифрованный архив не менялись.

## Локальная приёмка кандидата 30.9.0 · 27 ноября 2026

Android AI Insights расположен ниже карточки Total Assets. В WebApp Planner выводит метку Demo для соответствующей сессии. Локальная демонстрация использует синтетические допущения роста и аренды, без изменения расчётов. Положительные компоненты формируют сектора, отрицательные суммы показываются отдельно. Подтверждённые рыночные данные для выпуска ещё не загружены.

Серверный прогон: 443 пройдено, 57 пропущено. Целевой прогон с изолированным PostgreSQL: 116 пройдено, 1 пропущен (живой Gemini). WebApp собрался, 56 тестов прошли. Android TypeScript и 48 Jest прошли. Самостоятельные ARM64 APK Normal и Quick Login INTERNAL TEST собраны с versionCode 12 и установлены поверх предыдущих тестовых сборок на эмуляторе. Действующая production-подпись требует отдельной сверки. Quick Login использует локальный QA-мост на порту 7019.

GitHub main на `3a9ae500893c35cafc864c64a40948f7558fc8cd`. Рабочий API сообщил версию 30.8.4. Кандидат остаётся локальным до подтверждения резервной копии рабочей БД, точек отката и проверок на целевых сервисах. Зашифрованный архив проверен отдельно. Продажа целого объекта и новая автоматизация аренды остаются в backlog.


## Monthly Reports 30.9.3 · 28 November 2026

Real investors now use GET /api/monthly-reports, scoped to the JWT owner. Demo continues through GET /api/demo/monthly-reports. Both clients reuse the existing report cards and allocation charts. The WebApp menu entry is between Identity Verification and Inbox. Android reuses its existing MonthlyReports route. Report text supports RU/EN using the device/browser locale.

InvestorMonthlyReports stores one immutable snapshot per investor and UTC calendar month. GeneratedAt is the actual capture date shown in clients. The first snapshot has zero change with an explicit missing-previous commentary. Later changes compare the previous available snapshot. Capital is wallet plus current share value using the existing price/total-shares rule. Credited rental receipts are separately disclosed and already included in the wallet. Demo retains its existing missing-price fallback. No reliable historical property valuations were found, so historical capital is not reconstructed.

The existing MonthlyReportsHostedService captures snapshots on its monthly run. No new scheduler. Initial rollout captures actual current state through the same service, without sending email. A unique database index and transaction lock protect retries/concurrency. The additive migration is 20261128142940_InvestorMonthlySnapshots3093. Snapshot creation does not change financial records. Existing email uses the saved snapshot and shared deterministic commentary alongside its original ledger-period PDF. Delivery remains unconfirmed.

Local verification: backend builds, three isolated PostgreSQL tests passed (capture/idempotence/ownership/Demo isolation and existing no-delivery email/Demo monthly scenarios), additive migration and initial seeding passed locally. WebApp build and 56 tests passed. Investor smoke passed normal/Demo at 320/390/760/1024/1440 px with loading/error/retry/empty paths. Android typecheck reports errors in the existing local LoginScreen.tsx. Four existing targeted RN checks passed. APK build is left to the user.

Production: read-only preflight verified the expected database, TLS and baseline PaymentEvidence306. A protected pre-rollout pg_dump was saved under C:/App/work/monthly3093. The authorized additive migration and initial capture completed, reporting 10 real investor snapshots. Backend/WebApp publication and authenticated production UI verification are pending at this entry.


### Production acceptance 30.9.3

Render deployment dep-dc5ee395efls73f7es2g is Live at f8cc3fbbe68f64f37b6fe3c1047fec4a545f9490. GET /health confirms release 30.9.3 and this SHA. Rollback target is dep-dc5391uc6qcc73fikshg (ce2415f). Cloudflare Worker ownersclub-webapp-30-8-4 is Ready at version 204f8ddf, with rollback version eec3ebfc. Live bundle is index-KckxvLjn.js / index-DGLe4FsK.css and SPA fallback is single-page-application.

Authenticated production acceptance passed in the ordinary investor workspace at https://wamsoc.com/monthly-reports. The new menu entry appears between Identity Verification and Inbox. Its initial report is dated 28 November 2026 and matches current account wallet plus investments. Cumulative credited rent is separately displayed. The initial-snapshot commentary is explicit, RU text is rendered, and the legend was inspected at 1440 and 390 px. Anonymous GET /api/monthly-reports returns 401. Production Demo login was not exercised; Demo server processing and UI were covered by isolated tests. Email delivery remains unconfirmed.

Initial production seeding completed with 10 reports after the protected backup. Migration baseline was verified before application. Historical snapshots remain unavailable because past property valuation observations are absent. The local concurrency/retry test passed using two simultaneous capture requests plus another retry. Android MonthlyReports tests passed for real/Demo API selection, owner cache, localized request headers and empty state. The latest Android typecheck has nine errors, all in the pre-existing local LoginScreen.tsx. APK/device acceptance remains with the user.

Cloudflare publication recovery: Wrangler deployment returned “No access to the specified resource”. The authenticated dashboard was used for the existing Worker, uploading C:/App/WebApp/dist and explicitly selecting SPA fallback. The uploader accepted a Windows backslash path. Verify the Ready version and the bundle served by wamsoc.com after publication. No credentials were added to documentation.


### Monthly Reports 30.9.3 localization correction

Monthly Reports follows the existing English account interface in WebApp and Android. Browser/device language and Accept-Language no longer switch the report page or normal report commentary to Russian. The menu label is Monthly Reports. Dates use en-US with the snapshot calendar date preserved in UTC, and USD amounts use English currency formatting. Demo commentary already uses English. Financial calculations, stored snapshots and schema are unchanged.

Localization acceptance passed for Normal and Demo in browsers configured with en-US and ru-RU, checking the menu, page text, expanded commentary, Nov 28, 2026 and $1,200.50. A targeted backend test confirms both report endpoints return English commentary with Russian Accept-Language. Two Android MonthlyReports tests passed with English empty-state text and en-US request headers. This correction keeps release 30.9.3.
