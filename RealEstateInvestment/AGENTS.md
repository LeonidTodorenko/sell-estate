# OwnersClub API

Начни с [корневых инструкций](../AGENTS.md) и строки в [карте](../docs/CODE-MAP.md). [Program.cs](Program.cs) подключает JWT, PostgreSQL, контроллеры и службы. Маршрут и авторизацию ищи в атрибутах контроллера, отношения и ограничения — в [AppDbContext](Data/AppDbContext.cs).

Для финансовых операций сверь [FinancialActor](Helpers/FinancialActor.cs), [FinancialConcurrencyAttribute](Helpers/FinancialConcurrencyAttribute.cs) и область транзакции. Проследи живой и demo-пути, изменения баланса и долей, повтор операции и запись аудита. Для фоновых переходов начни с [ScheduledTaskService](Services/ScheduledTaskService.cs). Смотри [правила](../docs/BUSINESS-RULES.md) и [команды API](../docs/ARCHITECTURE.md#backend). Перед запуском API или интеграционных тестов проверь, какая БД будет использована.
