# OwnersClub FAQ 30.7.1

Правила сверены с backend 30.6.1, commit `abcda8e669d86522514e6d0c0dfdc44e57b008f0`. Ссылки Sources ведут к исходникам, подтверждающим ответ. Ответы и варианты запроса обновляются вместе с версией. При поиске учитываются только явно перечисленные варианты.

## investments
Aliases: инвестиции | как инвестировать | investments | how to invest
В стандартном сценарии цена доли списывается полностью один раз. На активном первом этапе заявка резервирует доли до решения. При отклонении подтверждённый резерв возвращается, а при частичном принятии возвращается его неиспользованная часть. Последующая прямая покупка создаёт инвестицию сразу. Условия и доступность зависят от конкретного объекта.
Sources: [InvestmentWorkflowController](../../../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs) | [InvestmentApplication](../../../RealEstateInvestment/Models/InvestmentApplication.cs) | [Investment](../../../RealEstateInvestment/Models/Investment.cs)

## payment-plan
Aliases: график платежей | план платежей | payment plan | payment schedule
График платежей привязан к объекту. Запись плана содержит дату события, срок и сумму. Проценты описывают этапы финансирования объекта. Цена приобретаемых долей списывается целиком. Изменение плана через API блокируется при наличии заявок объекта в статусах pending или carried.
Sources: [PaymentPlanController](../../../RealEstateInvestment/Controllers/PaymentPlanController.cs) | [PaymentPlan](../../../RealEstateInvestment/Models/PaymentPlan.cs)

## marketplace
Aliases: marketplace | маркетплейс | продажа долей | как купить доли
В Marketplace доступны активные предложения, а для предложения предусмотрены покупка и подача ставки. При покупке сервер проверяет условия предложения и баланс покупателя. Размер комиссии зависит от правил Club и операции.
Sources: [ShareOfferController](../../../RealEstateInvestment/Controllers/ShareOfferController.cs) | [UserFeeHelper](../../../RealEstateInvestment/Helpers/UserFeeHelper.cs)

## wallet
Aliases: кошелёк | кошелек | баланс | мой баланс | wallet | my balance | wallet balance
Баланс кошелька хранится отдельно от инвестиций. Платёж может иметь разные валюты списания и зачисления. Зачисление подтверждается временем зачисления в записи платежа. Свой текущий баланс можно получить через GET /api/assistant/me/balance после входа инвестора.
Sources: [User](../../../RealEstateInvestment/Models/User.cs) | [WalletPaymentsController](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs) | [AssistantController](../../../RealEstateInvestment/Controllers/AssistantController.cs)

## manual-evidence
Aliases: ручной платёж | ручной платеж | подтверждение платежа | чек | manual payment | payment evidence
В тестовом режиме к открытой ручной заявке можно добавить комментарий или файл PDF, JPEG либо PNG до 5 МиБ. Статус открытой заявки — requested или processing. Администратор может запросить уточнение. Подтверждение добавляется в историю, зачисление выполняется отдельной операцией.
Sources: [PaymentEvidenceController](../../../RealEstateInvestment/Controllers/PaymentEvidenceController.cs) | [WalletPaymentsController](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs)

## kyc
Aliases: kyc | верификация | проверка документов | как пройти kyc
Загруженный KYC-документ получает статус pending. После проверки документ может получить статус approved или rejected. Документы доступны через авторизованные маршруты с проверкой доступа.
Sources: [KycController](../../../RealEstateInvestment/Controllers/KycController.cs) | [PrivateDataAccess](../../../RealEstateInvestment/Helpers/PrivateDataAccess.cs)

## club
Aliases: club | клуб | статус клуба | комиссия клуба | club status
Сведения Club включают расчётную стоимость активов, статус и ставки комиссии. Пороги для Expert, Visionary и VIP составляют 10 000, 50 000 и 100 000 соответственно. Ниже первого порога действует Explorer. Ставки в сведениях Club показаны для базового и реферального случая.
Sources: [ShareOfferController](../../../RealEstateInvestment/Controllers/ShareOfferController.cs) | [UserFeeHelper](../../../RealEstateInvestment/Helpers/UserFeeHelper.cs)

## referral
Aliases: referral | реферал | реферальный код | приглашение | referral invite
Для реферального приглашения предусмотрены выпуск кода и его активация. При выпуске сервер проверяет право пригласить и достаточность баланса для списания 10 USD. При активации сервер проверяет статус и срок приглашения.
Sources: [ReferralsController](../../../RealEstateInvestment/Controllers/ReferralsController.cs) | [ReferralInvite](../../../RealEstateInvestment/Models/ReferralInvite.cs)

## demo
Aliases: demo | демо | демо режим | демо-режим | demo account
Демо использует отдельные записи для кошелька, инвестиций и заявок. Доступ зависит от активности и срока действия демо-аккаунта. Пополнение демо-кошелька симулируется.
Sources: [AppDbContext](../../../RealEstateInvestment/Data/AppDbContext.cs) | [FinancialActor](../../../RealEstateInvestment/Helpers/FinancialActor.cs) | [DemoWalletController](../../../RealEstateInvestment/Controllers/DemoWalletController.cs)
