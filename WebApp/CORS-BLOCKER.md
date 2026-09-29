# CORS — историческое наблюдение и текущая локальная конфигурация

Обновление Iteration 8 (25 сентября 2026): локальный `Program.cs` уже разрешает wamsoc.com, www.wamsoc.com и localhost:5173. `127.0.0.1:5173` отсутствует в allowlist; используйте localhost:5173 для локальной ручной проверки. Состояние опубликованного Render в этой итерации не проверялось. Iteration 7 также исправила Demo-ветку `/auth/me`; WebApp Profile теперь получает SafeUserResponse через `/users/{id}`. Текст ниже сохранён как история проверки 8 сентября, а не текущий release blocker.

Проверено 8 сентября 2026. Backend не изменён.

В `C:\App\RealEstateInvestment\Program.cs` политика `Frontend` (строки 76–87) разрешает только:

- `https://todtech.ru`
- `https://www.todtech.ru`
- `https://sell-estate.onrender.com`

Live Render:

| Проверка | Ответ |
| --- | --- |
| OPTIONS `/api/auth/login`, Origin `http://localhost:5173`, POST, content-type | 204 без Access-Control-Allow-Origin |
| OPTIONS `/api/auth/login`, Origin `https://wamsoc.com`, POST, content-type | 204 без Access-Control-Allow-Origin |
| OPTIONS `/api/properties`, Origin `https://todtech.ru`, GET, authorization | 204, Allow-Origin `https://todtech.ru`, Allow-Methods `GET`, Allow-Headers `authorization` |
| Edge fetch GET `/api/properties` с `http://127.0.0.1:5173` | Failed to fetch; console: blocked by CORS policy, no Access-Control-Allow-Origin |

HTTP 204 сам по себе не означает успешный CORS preflight: нужен Allow-Origin для конкретного origin.

Минимальное предлагаемое изменение, только для отдельного рассмотрения и применения владельцем backend: добавить в существующий `WithOrigins`:

```csharp
"http://127.0.0.1:5173",
"http://localhost:5173",
"https://wamsoc.com"
```

`https://www.wamsoc.com` нужен только если сам web-клиент будет обслуживаться и на www, а не редиректиться на основной адрес. Preview origins также должны добавляться явно при необходимости. Существующие `.AllowAnyHeader()` и `.AllowAnyMethod()` уже покрывают `Authorization`, `Content-Type`, GET/POST/OPTIONS. `.AllowCredentials()` не требуется: web fetch использует `credentials: 'omit'`, авторизация — Bearer header. Не заменять allowlist на `*` ради решения этого blocker.

После отдельного выпуска backend проверить эти же preflight, затем login и все GET endpoints с действительными demo/production credentials. Ни API-контракты, ни БД, ни миграции для этого изменения не нужны.

Прочие ограничения: demo refresh token отсутствует по текущему серверному контракту; `/auth/me` не обслуживает demo, поэтому профиль построен на login session + total-assets. Контролируемые smoke tests не подтверждают, что все актуальные backend изменения уже развёрнуты на Render.
