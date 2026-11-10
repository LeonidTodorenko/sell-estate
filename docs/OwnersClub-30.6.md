# OwnersClub 30.6 — локально подготовлено, публикация pending

10 ноября 2026, Europe/Moscow. APK не собирался; commit/push/deploy, Live-мутации, backup и pg_dump не выполнялись. BackgroundJobs/scheduler logic/config не менялись. Samsung hardware QA не проводилась.

## Причины

- Android Dashboard не имел маршрута/пункта платёжной очереди, хотя backend `/api/payments/admin/queue` и WebApp `/admin/payments` уже существовали.
- Admin Messages запрашивал `/api/messages/all`; маршрут отсутствовал в MessageController. Добавлен admin-only GET с проверкой актуальных прав. `/users/all` и `/messages/send` уже существовали; prefix `/api` правильный. Двусторонний support chat остаётся существующим `/api/chat`, а административные уведомления — `/api/messages`.
- Home показывал ScreenLoader, но `fetchPropertiesWithExtras(20)` и его вложенные запросы включали глобальный LoadingContext. Gate/ensureUser также могли накладывать глобальный индикатор. Их запросы теперь поддерживают silentLoading; Home/Gate управляют своим первоначальным индикатором. Фоновая загрузка транзакций уже была silent.

## Изменения

- Android: новый AdminPaymentsScreen, заметный пункт «Платежи и заявки» со счётчиком; глобальный pending count, фильтры метода/статуса, последние 100 записей, суммы/валюты/комиссия/курс/автор/детали. TEST bank approve, отклонение TEST manual-заявки с причиной, документы/уточнения. Ссылки из «Финансы» и к существующей очереди withdrawals. JWT и актуальный backend RBAC обязательны.
- AddFunds Android/WebApp: вложения и комментарий к существующему payment UUID, сохранённая история и дозагрузка после уточнения. Новая заявка для ответа не создаётся, email-процесс не добавлен.
- WebApp `/admin/payments`: существующий UI дополнен счётчиком, ссылкой withdrawals, документами/скачиванием и запросом уточнения без отказа. Финансовые действия UI ограничены TEST-записями. Историческая серверная live-ветка 30.3 не расширялась и не вызывалась.
- Backend: PaymentEvidence с FK к существующей SandboxPayments; private bytea storage PostgreSQL. Аддитивная EF migration PaymentEvidence306. GET history/file, multipart submission, admin clarification и admin summary. Зачисление остаётся прежним атомарным WalletPaymentsController.Review; ни загрузка файла, ни уточнение не меняют баланс и не подтверждают поступление.

## Ограничения и безопасность

- Только TEST manual requests. PDF/JPEG/PNG, проверка MIME и сигнатуры, 5 МиБ/файл, максимум 5 файлов и 50 записей истории на заявку, комментарий до 2000 символов. Блокировка строки заявки сериализует дозагрузку, проверку лимита и финансовое решение; закрытая заявка не принимает новые записи.
- Без публичных URL, путей/имён от клиента и токенов в URL. Владелец либо актуальный admin, запрет demo; no-store, nosniff, sandbox CSP и attachment download. Audit содержит IDs, размер и SHA-256; комментарии и содержимое файлов не попадают в audit.
- Android открывает скачанный по JWT документ через приватный cache/FileProvider в установленном PDF/image viewer. Временное read-разрешение и файл удаляются через 15 минут, при выходе очищаются; при следующей инициализации модуль очищает остатки. Если на телефоне нет просмотрщика PDF, приложение покажет ошибку с предложением установить его. Фактический picker/viewer, permission flow и обновление приложения требуют проверки на устройстве. APK потребуется собирать отдельно после разрешения.
- Хранилище требует только аддитивной таблицы в имеющейся PostgreSQL, отдельный публичный storage не нужен. До публикации миграция должна быть применена к целевой БД. Проверка сигнатур не является антивирусным сканированием; документы принудительно скачиваются/открываются системным просмотрщиком.

## Проверки

- Backend: 406 PASS, 0 FAIL, 1 SKIP (RestoredPostgresStatsPreserveEveryDigit требует восстановленную копию; dump по указанию пользователя не делался).
- Новые backend-тесты: owner/admin privacy, чужой доступ, demo/live/closed запреты, MIME/signature spoofing, размер/число файлов/комментарий, clarification/reupload без зачисления, PostgreSQL два конкурентных approve → один balance/journal/audit, admin messages 200 вместо 404 и двусторонняя переписка с запретом чужого чтения.
- Android: typecheck PASS; Jest 46/46, 12 suites. Нативный compileInternalQaKotlin PASS. Assemble/package APK не запускались.
- WebApp: typecheck/build PASS; 49/49 tests PASS.
- Edge headless browser smoke через фактические локальные ASP.NET controllers и PostgreSQL: `/admin/payments`, создание TEST bank-заявки, PNG+комментарий, clarification, ответ владельца, скачанные bytes MATCH, approve/replay и подтверждение зачисления у владельца. Без page errors. Декоративные user/unread запросы оболочки заменены fixture-ответами; payment/evidence/review работают с реальным локальным backend. Предыдущий встроенный browser connector завершился таймаутом; итоговая проверка выполнена Edge.
- Первый прогон новых тестов выявил ошибки fixture (не сохранён seed, отсутствующая новая таблица у старых EnsureCreated-БД, глобальная вместо UUID-фильтрованной проверки журнала). Исправлены QA fixture/проверки; итоговый полный прогон выше зелёный.

## App/Data и сохранность

30 изменённых/новых исходников и документация зеркалируются из C:\App в C:\Data\sell_estate\sell-estate. Для каждого файла — SHA-256 App/Data в отдельном manifest CSV/JSON; подтверждено 30/30 MATCH. Data использовалась только для копирования и хеширования. У старого Data AndroidManifest отсутствовал уже существующий App payment deep-link: сохранён App deep-link вместе с новым FileProvider. Прочих конфликтов не обнаружено.

11 проверок сохранности подтверждают неизменность исходных 30.1–30.5/QA diagnostics, appsettings, версий/зависимостей Android и scheduler: preservation.json. Никакие посторонние dirty-файлы не откатывались.

Публикация pending. Следующий отдельный этап после разрешения: целевая аддитивная миграция/backend/WebApp; APK и Samsung QA также отдельный этап.
