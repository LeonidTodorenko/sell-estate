# OwnersClub 30.5 — Release Preparation

Android: 0.7.0-internal (versionCode 7), com.investorapp. Internal ARM64-v8a standalone build, Hermes and JavaScript embedded, debuggable=false, minification/resource shrinking enabled. Uses the same internal debug certificate as 0.6.0-internal (code 6); this identity is explicitly retained for internal updates. Store release signing remains separately guarded.

Build from C:\App\InvestorApp\android:

    .\gradlew.bat :app:assembleInternalQa -PreactNativeArchitectures=arm64-v8a --max-workers=2

The release preparation build excludes pre-existing local QA diagnostics in api.ts/LoginScreen.tsx and restores those edits afterward. Do not distribute an arbitrary later local rebuild without reviewing local changes and verifying it again. Canonical source for this APK: ee6e934 plus the 30.5 Android version/ABI/package changes. No temporary QA entrypoints or Metro server are needed.

Configuration: https://sell-estate.onrender.com/api; payment environment is supplied by the backend, not an APK secret. Mobile return link: ownersclub://payments/return. Android sends client=android; the backend validates the exact mobile return URI. Returning through a link cannot itself credit money.

Scheduler monitoring (local changes, not deployed): admin GET /api/investment-workflow/scheduler-runs reads the newest 200 operational events from existing ActionLogs. Each tick has a run UUID, started event and completed/completed_with_issues/failed event. Property/offer failures and deferred concurrency conflicts are recorded separately. Only IDs and exception type names are stored, never exception text or connection strings. Events survive service restarts. An unfinished start can indicate interruption; database outages can leave monitoring gaps, with failures logged to server output. Existing reconciliation conflicts remain in their original list. No financial write endpoint or manual scheduler-run control is added; no schema migration is needed. Schedule and financial rules are unchanged.

## Передача тестировщикам

1. Передавать один проверенный APK OwnersClub-0.7.0-internal-7-arm64-v8a.apk через закрытую папку команды. Не делать ссылку публичной. В той же папке держать SHA256SUMS.txt и release notes; пометить прежние APK как архивные. Публикация файла в облако этой итерацией не выполняется.
2. Проверить SHA-256 скачанного файла по SHA256SUMS.txt. Нужен Android ARM64-v8a, API 24 или выше. Это внутренний тестовый контур YooKassa TEST.
3. Установить поверх существующего com.investorapp, не удаляя приложение и не очищая его данные. Та же подпись и больший versionCode позволяют обновление с code 6 с сохранением данных; фактическое обновление и сохранность сессии ещё нужно проверить на Samsung. Если Android предлагает удалить старое приложение или сообщает конфликт подписи — остановиться и сообщить об ошибке.
4. Пользователь устанавливает APK самостоятельно. Затем проверить запуск без Metro, сохранение входа, открытие объекта/PaymentPlan, покупку долей, Add Funds и возврат по deep link, заявку на вывод. Никаких реальных платежей и выплат.
5. Сообщать версию, модель телефона, Android и шаги воспроизведения ошибки. Не присылать пароли, токены, карточные данные или keystore.

Мини-релиз требует проверки на физическом ARM64-устройстве. Проверка x86_64 не заменяет её. Backend/WebApp 30.5 остаются локально; отдельное разрешение на публикацию ещё не запрашивалось. BackgroundJobs Live остаётся ON; backup/dump и финансовые Live-мутации не выполняются.
