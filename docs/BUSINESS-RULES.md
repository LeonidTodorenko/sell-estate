# Правила операций OwnersClub

## Покупка, заявки и PaymentPlan

[InvestmentController](../RealEstateInvestment/Controllers/InvestmentController.cs) — серверная покупка и возвраты. Сверяй принадлежность операции, доступность долей, баланс и сумму с серверным состоянием. Отслеживай баланс, доступные доли и инвестицию вместе. При отмене или неуспешной валидации оплаты код возвращает сумму и освобождает доли там, где это предусмотрено переходом.

`POST /api/investments/apply` принимает положительное целое число долей и сверяет сумму с ценой на сервере. Если передан `Idempotency-Key`, он должен быть непустым UUID. Повтор с совпадающими параметрами использует запись прежней операции, а повтор ключа с другой операцией приводит к конфликту. В пути с резервом деньги и доли списываются при создании заявки.

[InvestmentApplicationsController](../RealEstateInvestment/Controllers/InvestmentApplicationsController.cs) обрабатывает заявки, [InvestmentWorkflowController](../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs) показывает историю и принимает административное решение, [PaymentPlanController](../RealEstateInvestment/Controllers/PaymentPlanController.cs) ведёт план оплаты, а [ScheduledTaskService](../RealEstateInvestment/Services/ScheduledTaskService.cs) выполняет фоновые переходы. В решении с частичным подтверждением возвращаются соответствующая сумма и лишние доли. При работе с планом проверь порядок этапов, даты, подтверждение и правила обработки резерва в [InvestmentStages](../RealEstateInvestment/Helpers/InvestmentStages.cs) и [InvestmentReservationProof](../RealEstateInvestment/Helpers/InvestmentReservationProof.cs).

Планировщик рассматривает `pending` и `carried` по наступившему `DueDate`. Перед изменениями он проверяет исходный дебет резерва, владельца и этап. Если `Paid + сумма заявок >= Total`, создаёт инвестиции из резерва без повторного списания. Иначе возвращает деньги и доли, проверяет лимит долей объекта и записывает возврат. Эти условия относятся к показанному в коде пути планировщика.

## KYC

[KycController](../RealEstateInvestment/Controllers/KycController.cs) проверяет право на чтение документов через `PrivateDataAccess.RequireOwnerAsync` с разрешённым административным доступом. Демо-путь читает документы текущего демопользователя. Очередь и решение требуют `FinancialAdmin`. Одобрение переводит документ из `pending` в `approved` и вызывает [KycContractService](../RealEstateInvestment/Services/KycContractService.cs) после сохранения. При проверках используй синтетические документы.

## Marketplace

[ShareOfferController](../RealEstateInvestment/Controllers/ShareOfferController.cs) ведёт объявления, покупку, ставки, отмену и продажу платформе. При выставлении доли вычитаются из позиций для резерва. Для покупки и отмены проверяй активность сделки, принадлежность, остаток и расчёт комиссии на выбранном маршруте. Проверяй отдельно ветки обычного и demo-пользователя. Основные изменения выполняются в транзакциях Serializable.

## Аренда

[RentalIncomeController](../RealEstateInvestment/Controllers/RentalIncomeController.cs) содержит выплату по объекту и историю инвестора. Проследи доли, допущенные к начислению, валовой доход, комиссию, чистую выплату и, при наличии, реферальную часть. Код округляет комиссию, чистую сумму и реферальное вознаграждение до двух знаков. Изменения проводятся в Serializable-транзакции. Для случая повторного начисления сверяй проверки конкретного периода и записи начислений.

## InvestmentLedger и конкуренция

[InvestmentLedger.Record](../RealEstateInvestment/Helpers/InvestmentLedger.cs) добавляет финансовую транзакцию и аудит инвестиционного дебета/возврата. Идентификаторы связывают затронутого пользователя, объект, проводку и источник. `Guid.Empty` для актёра передаётся в аудите как scheduler. Область атомарности определяется вызывающим кодом. Найди вызовы Record и проверь их вместе с балансом и долями. [FinancialConcurrencyAttribute](../RealEstateInvestment/Helpers/FinancialConcurrencyAttribute.cs) используется на финансовых endpoints вместе с транзакциями. Для повторов проверяй защиту конкретного маршрута.

## Кошелёк и Android

[WalletPaymentsController](../RealEstateInvestment/Controllers/WalletPaymentsController.cs) обслуживает создание, статус, webhook и административную обработку. [WalletPayments](../RealEstateInvestment/Services/WalletPayments.cs) формирует запрос ЮKassa, передаёт ключ идемпотентности и проверяет серверное состояние платежа. Обновление с проверкой `CreditedAt` защищает от повторного зачисления в соответствующих ветках. Документы оплаты обрабатываются в [PaymentEvidenceController](../RealEstateInvestment/Controllers/PaymentEvidenceController.cs).

Android принимает `ownersclub://payments/return` через [манифест](../InvestorApp/android/app/src/main/AndroidManifest.xml) и [AppNavigator](../InvestorApp/src/navigation/AppNavigator.tsx), который связывает маршрут с TopUp. [TopUpScreen](../InvestorApp/src/screens/TopUpScreen.tsx) подключает [AddFunds](../InvestorApp/src/screens/AddFunds.tsx), который открывает checkout и получает серверный статус. Возврат только продолжает клиентский сценарий. Кредитование выполняет сервер после проверки результата.
