# OwnersClub FAQ 30.7.2

В каждой записи два локальных ответа и ссылки на реализацию или подтверждённую документацию.

## app-overview
Group: account
RU: приложение | о приложении | ownersclub | что такое ownersclub | что это за приложение | расскажи о приложении | расскажи про приложение | расскажите о приложении | для чего нужно приложение | что можно делать в приложении | что я могу делать здесь
EN: app | the app | ownersclub | about the app | about ownersclub | what is this app | what is this app for | what does this app do | what does ownersclub do | what can i do here | what can i do in the app | what can i do with this app | what can i do with ownersclub | give me an overview of the app | introduce ownersclub
OwnersClub помогает управлять инвестициями в недвижимость. В приложении можно просматривать объекты и графики платежей, следить за своими инвестициями и заявками, проверять баланс кошелька и историю операций. Хотите узнать, с чего начать, или подробнее разобрать одну из этих функций?
OwnersClub is an app for managing real estate investments. You can explore properties and their payment plans, track your investments and applications, and view your wallet balance and transaction history. Would you like to know how to get started or explore one of those features?
Sources: [WebApp README](../../../WebApp/README.md) | [WebApp routes](../../../WebApp/src/main.tsx)

## register
Group: account
RU: регистрация аккаунта | регистрация | как зарегистрироваться | создать аккаунт
EN: account registration | registration | sign up | create an account
Для регистрации нужны email, пароль и решение CAPTCHA.
Registration requires an email, password, and CAPTCHA solution.
Sources: [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs) | [RegisterScreen.tsx](../../../InvestorApp/src/screens/RegisterScreen.tsx)

## register-email
Group: account
RU: занятый email
EN: email already registered
Сервер удаляет пробелы по краям email и проверяет дубликаты без учёта регистра.
The server trims the email and checks for duplicates case-insensitively.
Sources: [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs) | [RegisterScreen.tsx](../../../InvestorApp/src/screens/RegisterScreen.tsx)

## register-state
Group: account
RU: статус после регистрации
EN: new account status
Новый аккаунт создаётся заблокированным, с ролью under-registration и неподтверждённым email.
A new account starts blocked with role under-registration and unconfirmed email.
Sources: [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs) | [RegisterScreen.tsx](../../../InvestorApp/src/screens/RegisterScreen.tsx)

## register-referral
Group: account
RU: реферальный код при регистрации
EN: referral code at signup
В форме регистрации Android есть поле кода приглашения. Сервер проверяет статус и срок приглашения.
Android signup has an invite code field. The server checks invite status and expiry.
Sources: [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs) | [RegisterScreen.tsx](../../../InvestorApp/src/screens/RegisterScreen.tsx)

## pin-format
Group: account
RU: формат пин кода
EN: pin format
Если при регистрации задан PIN, он должен содержать ровно четыре цифры.
If a PIN is supplied at signup, it must consist of exactly four digits.
Sources: [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs) | [RegisterScreen.tsx](../../../InvestorApp/src/screens/RegisterScreen.tsx)

## email-confirmation
Group: account
RU: подтверждение электронной почты | подтвердить email | подтвердить почту
EN: email confirmation | confirm email | verify email
Подтверждение выполняется по ссылке с токеном. При успешной проверке сервер подтверждает email, присваивает роль investor и снимает блокировку регистрации.
Email confirmation uses a link containing a token. Successful verification confirms the email, assigns the investor role, and removes the registration block.
Sources: [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs)

## password-recovery
Group: account
RU: восстановление пароля | забыл пароль | сбросить пароль
EN: password recovery | forgot password | reset password
Сначала запрашивается сброс пароля. Затем новый пароль устанавливается с токеном сброса.
Request a password reset first, then use the reset token to set a new password.
Sources: [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs)

## profile
Group: account
RU: редактирование профиля
EN: edit profile
Профиль обновляется отдельной операцией с проверкой доступа к аккаунту.
A dedicated profile update operation checks account access.
Sources: [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs)

## profile-avatar
Group: account
RU: аватар профиля
EN: profile avatar
Аватар загружается отдельно от изменения данных профиля.
The avatar is uploaded separately from profile edits.
Sources: [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs)

## profile-password
Group: account
RU: смена пароля
EN: change password
Для смены пароля в профиле сервер проверяет текущий пароль.
Changing a password from the profile requires the current password.
Sources: [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs)

## pin-prompt
Group: account
RU: запрос пин или пароля
EN: pin or password prompt
Окно подтверждения в Android принимает PIN или пароль и скрывает ввод.
The Android confirmation dialog accepts a PIN or password and masks input.
Sources: [PinPromptModal.tsx](../../../InvestorApp/src/components/PinPromptModal.tsx)

## investment-pin
Group: account
RU: пин для покупки долей | пароль для инвестиции
EN: investment pin | purchase confirmation password
При покупке через инвестиционную заявку сервер проверяет PIN или пароль. Если PIN не задан, подтверждение проходит по паролю.
For a purchase through the investment application flow, the server checks the PIN or password. If no PIN is set, the password is required.
Sources: [InvestmentController.cs](../../../RealEstateInvestment/Controllers/InvestmentController.cs) | [PinPromptModal.tsx](../../../InvestorApp/src/components/PinPromptModal.tsx)

## kyc
Group: identity
RU: kyc | верификация | проверка документов | как пройти kyc
EN: kyc | identity verification
Загруженный KYC-документ получает статус pending.
An uploaded KYC document receives status pending.
Sources: [KycController.cs](../../../RealEstateInvestment/Controllers/KycController.cs) | [PrivateDataAccess.cs](../../../RealEstateInvestment/Helpers/PrivateDataAccess.cs)

## kyc-result
Group: identity
RU: результат проверки kyc
EN: kyc review outcome
Проверка администратором переводит документ в approved или rejected.
Admin review moves a document to approved or rejected.
Sources: [KycController.cs](../../../RealEstateInvestment/Controllers/KycController.cs) | [PrivateDataAccess.cs](../../../RealEstateInvestment/Helpers/PrivateDataAccess.cs)

## kyc-access
Group: identity
RU: доступ к документам kyc
EN: kyc document access
Просмотр документов требует авторизации и проверки доступа к аккаунту.
Document viewing requires authentication and an account-access check.
Sources: [KycController.cs](../../../RealEstateInvestment/Controllers/KycController.cs) | [PrivateDataAccess.cs](../../../RealEstateInvestment/Helpers/PrivateDataAccess.cs)

## kyc-queue
Group: identity
RU: очередь проверки kyc
EN: kyc review queue
В административной очереди проверки перечислены документы со статусом pending.
The admin review queue lists documents with status pending.
Sources: [KycController.cs](../../../RealEstateInvestment/Controllers/KycController.cs) | [PrivateDataAccess.cs](../../../RealEstateInvestment/Helpers/PrivateDataAccess.cs)

## properties
Group: properties
RU: карточка объекта | каталог объектов
EN: property details | property catalog
В Android есть отдельная карточка объекта. Backend отдаёт связанные медиа отдельным запросом.
Android has a dedicated property details screen. The backend serves related media through a separate request.
Sources: [PropertyController.cs](../../../RealEstateInvestment/Controllers/PropertyController.cs) | [PropertyDetailScreen.tsx](../../../InvestorApp/src/screens/PropertyDetailScreen.tsx)

## property-images
Group: properties
RU: фотографии объекта
EN: property photos | property pictures
Список фотографий привязан к конкретному объекту.
The photo list belongs to a specific property.
Sources: [PropertyController.cs](../../../RealEstateInvestment/Controllers/PropertyController.cs) | [PropertyDetailScreen.tsx](../../../InvestorApp/src/screens/PropertyDetailScreen.tsx)

## property-presentation
Group: properties
RU: презентация объекта
EN: property presentation
Загруженная презентация доступна отдельным запросом для объекта.
An uploaded presentation is available through a separate property-level request.
Sources: [PropertyController.cs](../../../RealEstateInvestment/Controllers/PropertyController.cs) | [PropertyDetailScreen.tsx](../../../InvestorApp/src/screens/PropertyDetailScreen.tsx)

## property-video
Group: properties
RU: видео объекта
EN: property video
Ссылку на видео объекта можно установить отдельной административной операцией.
An admin can set the property video URL in a dedicated operation.
Sources: [PropertyController.cs](../../../RealEstateInvestment/Controllers/PropertyController.cs) | [PropertyDetailScreen.tsx](../../../InvestorApp/src/screens/PropertyDetailScreen.tsx)

## property-stats
Group: properties
RU: статистика объектов
EN: property statistics
Backend предоставляет отдельный список объектов со статистикой.
The backend provides a separate property listing with statistics.
Sources: [PropertyController.cs](../../../RealEstateInvestment/Controllers/PropertyController.cs) | [PropertyDetailScreen.tsx](../../../InvestorApp/src/screens/PropertyDetailScreen.tsx)

## investments
Group: investment
RU: инвестиции | как инвестировать
EN: investments | how to invest
На первом активном этапе заявка резервирует доли. Последующая прямая покупка создаёт инвестицию сразу.
An application in the active first stage reserves shares. A later direct purchase creates an investment immediately.
Sources: [InvestmentController.cs](../../../RealEstateInvestment/Controllers/InvestmentController.cs) | [InvestmentWorkflowController.cs](../../../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs)

## shares-debit
Group: investment
RU: списание цены долей
EN: share purchase debit
Цена долей списывается при создании резерва. Принятие резерва повторного списания не создаёт.
The share price is debited when reserved. Accepting the reservation does not debit it again.
Sources: [InvestmentController.cs](../../../RealEstateInvestment/Controllers/InvestmentController.cs) | [InvestmentWorkflowController.cs](../../../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs)

## application-reject
Group: investment
RU: возврат резерва
EN: reservation refund
При отклонении подтверждённый резерв возвращается, а доли освобождаются.
Rejection refunds a confirmed reservation and releases the shares.
Sources: [InvestmentController.cs](../../../RealEstateInvestment/Controllers/InvestmentController.cs) | [InvestmentWorkflowController.cs](../../../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs)

## application-partial
Group: investment
RU: частичное принятие заявки
EN: partial application acceptance
При частичном принятии неиспользованная сумма возвращается, а инвестиция отражает принятые доли.
Partial acceptance refunds the unused amount and creates an investment for the accepted shares.
Sources: [InvestmentController.cs](../../../RealEstateInvestment/Controllers/InvestmentController.cs) | [InvestmentWorkflowController.cs](../../../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs)

## application-carry
Group: investment
RU: перенос заявки
EN: application carry
Администратор может отдельным решением перенести заявку на доступный следующий этап.
An admin can explicitly carry an application to an available next stage.
Sources: [InvestmentController.cs](../../../RealEstateInvestment/Controllers/InvestmentController.cs) | [InvestmentWorkflowController.cs](../../../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs)

## application-history
Group: investment
RU: история решений по заявке
EN: application decision history
В истории есть статус, номер этапа и события. Сервер проверяет доступ владельца или администратора.
History contains status, stage number, and events. The server checks owner or admin access.
Sources: [InvestmentController.cs](../../../RealEstateInvestment/Controllers/InvestmentController.cs) | [InvestmentWorkflowController.cs](../../../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs)

## stage-status
Group: investment
RU: текущий этап объекта
EN: current property stage
Сведения об этапах включают время сервера, доступные доли и возможность подать заявку.
Stage details include server time, available shares, and whether applications are open.
Sources: [InvestmentController.cs](../../../RealEstateInvestment/Controllers/InvestmentController.cs) | [InvestmentWorkflowController.cs](../../../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs)

## round-acceptance
Group: investment
RU: принятие очереди этапа
EN: stage queue acceptance
Для принятия очереди проверяются её состав, покрытие порога и исходные списания резервов.
Queue acceptance checks its current membership, funding coverage, and original reservation debits.
Sources: [InvestmentController.cs](../../../RealEstateInvestment/Controllers/InvestmentController.cs) | [InvestmentWorkflowController.cs](../../../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs)

## payment-plan
Group: stages
RU: график платежей | план платежей
EN: payment plan | payment schedule
График привязан к объекту. Запись содержит дату события, срок и сумму.
A payment plan belongs to a property. Each entry has an event date, deadline, and amount.
Sources: [PaymentPlanController.cs](../../../RealEstateInvestment/Controllers/PaymentPlanController.cs) | [PaymentPlan.cs](../../../RealEstateInvestment/Models/PaymentPlan.cs) | [payment-plan-page.tsx](../../../WebApp/src/payment-plan-page.tsx)

## plan-share-price
Group: stages
RU: проценты этапов финансирования
EN: stage funding percentages
Проценты описывают этапы финансирования объекта. Цена долей списывается целиком.
Percentages describe property funding stages. Shares are charged at full price.
Sources: [PaymentPlanController.cs](../../../RealEstateInvestment/Controllers/PaymentPlanController.cs) | [PaymentPlan.cs](../../../RealEstateInvestment/Models/PaymentPlan.cs) | [payment-plan-page.tsx](../../../WebApp/src/payment-plan-page.tsx)

## plan-edit
Group: stages
RU: изменение графика платежей
EN: edit payment plan
API блокирует изменения плана при наличии заявок pending или carried.
The API blocks plan changes while there are pending or carried applications.
Sources: [PaymentPlanController.cs](../../../RealEstateInvestment/Controllers/PaymentPlanController.cs) | [PaymentPlan.cs](../../../RealEstateInvestment/Models/PaymentPlan.cs) | [payment-plan-page.tsx](../../../WebApp/src/payment-plan-page.tsx)

## scheduler-funded
Group: scheduler
RU: расчёт обеспеченного этапа
EN: funded stage settlement
В срок этапа scheduler сравнивает Paid плюс ожидающие резервы этапа с Total. Покрытая очередь принимается полностью.
At the deadline, the scheduler compares Paid plus stage reservations against Total. A funded queue is accepted in full.
Sources: [OwnersClub-30.4.1.md](../../../docs/OwnersClub-30.4.1.md) | [ScheduledTaskService.cs](../../../RealEstateInvestment/Services/ScheduledTaskService.cs)

## scheduler-underfunded
Group: scheduler
RU: недофинансированный этап
EN: underfunded stage
При нехватке средств scheduler отклоняет очередь и возвращает исходные резервы. Это касается и первого этапа.
An underfunded queue is rejected and its original reservations refunded, including in the first stage.
Sources: [OwnersClub-30.4.1.md](../../../docs/OwnersClub-30.4.1.md) | [ScheduledTaskService.cs](../../../RealEstateInvestment/Services/ScheduledTaskService.cs)

## scheduler-carry
Group: scheduler
RU: автоматический перенос заявок
EN: automatic application carry
Перенос выполняет администратор. Scheduler рассчитывает очереди в их текущих этапах.
An admin carries applications. The scheduler settles queues in their current stages.
Sources: [OwnersClub-30.4.1.md](../../../docs/OwnersClub-30.4.1.md) | [ScheduledTaskService.cs](../../../RealEstateInvestment/Services/ScheduledTaskService.cs)

## scheduler-conflict
Group: scheduler
RU: конфликт сверки резерва
EN: reservation reconciliation conflict
Если исходное списание отсутствует, неоднозначно или уже закрыто, расчёт объекта останавливается и создаётся конфликт сверки.
Missing, ambiguous, or settled original debits stop property settlement and record a reconciliation conflict.
Sources: [OwnersClub-30.4.1.md](../../../docs/OwnersClub-30.4.1.md) | [ScheduledTaskService.cs](../../../RealEstateInvestment/Services/ScheduledTaskService.cs)

## scheduler-atomic
Group: scheduler
RU: атомарность расчёта этапов
EN: atomic stage settlement
Очереди со сроком по одному объекту рассчитываются одной транзакцией. При сбое изменения откатываются.
Due queues for a property settle in one transaction. Changes roll back on failure.
Sources: [OwnersClub-30.4.1.md](../../../docs/OwnersClub-30.4.1.md) | [ScheduledTaskService.cs](../../../RealEstateInvestment/Services/ScheduledTaskService.cs)

## scheduler-state
Group: scheduler
RU: статус объекта после расчёта
EN: property status after settlement
Расчёт заявок сохраняет статус объекта и ранее принятые инвестиции.
Application settlement preserves property status and previously accepted investments.
Sources: [OwnersClub-30.4.1.md](../../../docs/OwnersClub-30.4.1.md) | [ScheduledTaskService.cs](../../../RealEstateInvestment/Services/ScheduledTaskService.cs)

## scheduler-monitor
Group: scheduler
RU: мониторинг фоновых расчётов
EN: scheduler monitoring
Администратор может просмотреть начала и результаты циклов, а также отдельный список конфликтов сверки.
Admins can view run starts and outcomes and a separate reconciliation conflict list.
Sources: [OwnersClub-30.5.md](../../../docs/OwnersClub-30.5.md) | [InvestmentWorkflowController.cs](../../../RealEstateInvestment/Controllers/InvestmentWorkflowController.cs)

## marketplace
Group: marketplace
RU: marketplace | маркетплейс | продажа долей | как купить доли
EN: marketplace | share marketplace
Marketplace показывает активные предложения. Доступны покупка и подача ставки.
Marketplace lists active offers and supports purchases and bids.
Sources: [ShareOfferController.cs](../../../RealEstateInvestment/Controllers/ShareOfferController.cs)

## market-buy
Group: marketplace
RU: покупка предложения | покупка на маркетплейсе
EN: buy a marketplace offer | marketplace purchase
При покупке сервер проверяет условия предложения и баланс покупателя.
Purchasing checks offer terms and the buyer's balance.
Sources: [ShareOfferController.cs](../../../RealEstateInvestment/Controllers/ShareOfferController.cs)

## market-bids
Group: marketplace
RU: ставка на доли
EN: bid on shares
Ставка и список ставок относятся к конкретному предложению.
A bid and the bid list belong to a specific offer.
Sources: [ShareOfferController.cs](../../../RealEstateInvestment/Controllers/ShareOfferController.cs)

## market-trades
Group: marketplace
RU: история сделок marketplace
EN: marketplace transaction history
История сделок Marketplace доступна отдельным запросом.
Marketplace trades have a dedicated history endpoint.
Sources: [ShareOfferController.cs](../../../RealEstateInvestment/Controllers/ShareOfferController.cs)

## market-cancel
Group: marketplace
RU: отмена предложения
EN: cancel a share offer
Владелец может снять предложение специальной операцией отмены.
The owner can withdraw an offer with a dedicated cancellation operation.
Sources: [ShareOfferController.cs](../../../RealEstateInvestment/Controllers/ShareOfferController.cs)

## market-extend
Group: marketplace
RU: продление предложения
EN: extend a share offer
При продлении предложения сервер проверяет новую дату окончания.
When extending an offer, the server checks its new end date.
Sources: [ShareOfferController.cs](../../../RealEstateInvestment/Controllers/ShareOfferController.cs)

## market-fee
Group: marketplace
RU: комиссия сделки
EN: marketplace fee
Ставка комиссии зависит от операции и данных Club. Ставки видны в сведениях Club.
Fees depend on the operation and Club details. Rates are shown in Club information.
Sources: [ShareOfferController.cs](../../../RealEstateInvestment/Controllers/ShareOfferController.cs) | [UserFeeHelper.cs](../../../RealEstateInvestment/Helpers/UserFeeHelper.cs)

## wallet
Group: wallet
RU: кошелёк | кошелек | баланс | мой баланс
EN: wallet | my balance | wallet balance
Свой баланс в USD можно прочитать после входа инвестора через GET /api/assistant/me/balance.
Signed-in investors can read their USD balance via GET /api/assistant/me/balance.
Sources: [AssistantController.cs](../../../RealEstateInvestment/Controllers/AssistantController.cs) | [User.cs](../../../RealEstateInvestment/Models/User.cs)

## own-investments
Group: wallet
RU: мои инвестиции
EN: my investments
Локальный маршрут инвестиций возвращает до 25 свежих записей владельца с объектом, долями и суммой.
The local investments endpoint returns up to 25 recent records owned by the investor, including property, shares and amount.
Sources: [AssistantController.cs](../../../RealEstateInvestment/Controllers/AssistantController.cs) | [User.cs](../../../RealEstateInvestment/Models/User.cs)

## own-applications
Group: wallet
RU: мои инвестиционные заявки
EN: my investment applications
Локальный маршрут заявок возвращает до 25 свежих записей владельца со статусом и числом запрошенных долей.
The local applications endpoint returns up to 25 recent records owned by the investor, including status and requested shares.
Sources: [AssistantController.cs](../../../RealEstateInvestment/Controllers/AssistantController.cs) | [User.cs](../../../RealEstateInvestment/Models/User.cs)

## own-payments
Group: wallet
RU: мои платежи
EN: my payments
Локальный маршрут платежей возвращает до 25 свежих записей владельца. Для Demo он помечен недоступным.
The local payments endpoint returns up to 25 recent payment records owned by the investor. It reports payments unavailable in Demo.
Sources: [AssistantController.cs](../../../RealEstateInvestment/Controllers/AssistantController.cs) | [User.cs](../../../RealEstateInvestment/Models/User.cs)

## wallet-add
Group: payments
RU: пополнение кошелька | как пополнить кошелек | пополнить баланс
EN: add funds | top up wallet | fund wallet
WebApp и Android запрашивают доступность пополнения у backend. Форма отключает недоступное пополнение.
WebApp and Android check funding availability with the backend and disable unavailable funding in the form.
Sources: [WalletPaymentsController.cs](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs) | [add-funds.tsx](../../../WebApp/src/add-funds.tsx) | [AddFunds.tsx](../../../InvestorApp/src/screens/AddFunds.tsx)

## payment-currency
Group: payments
RU: валюты платежа
EN: payment currencies
История показывает суммы и валюты списания и зачисления отдельно.
History lists charge and credit amounts and currencies separately.
Sources: [WalletPaymentsController.cs](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs) | [add-funds.tsx](../../../WebApp/src/add-funds.tsx) | [AddFunds.tsx](../../../InvestorApp/src/screens/AddFunds.tsx)

## payment-recover
Group: payments
RU: восстановление платежа
EN: recover payment
Форма запоминает идентификатор попытки и использует его повторно при восстановлении.
The form saves the attempt identifier and reuses it for recovery.
Sources: [WalletPaymentsController.cs](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs) | [add-funds.tsx](../../../WebApp/src/add-funds.tsx) | [AddFunds.tsx](../../../InvestorApp/src/screens/AddFunds.tsx)

## payment-history
Group: payments
RU: история пополнений
EN: funding history
История показывает метод, статус, суммы и маркер TEST для тестовых записей.
History shows the method, status, amounts, and a TEST marker for test records.
Sources: [WalletPaymentsController.cs](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs) | [add-funds.tsx](../../../WebApp/src/add-funds.tsx) | [AddFunds.tsx](../../../InvestorApp/src/screens/AddFunds.tsx)

## yookassa
Group: payments
RU: юкасса тест | тестовая yookassa | юкасса
EN: yookassa test | test yookassa payment | yookassa
При выборе YooKassa форма предлагает перейти к оплате. Тестовый контур помечает операции TEST.
The YooKassa option offers to continue to payment. The test environment marks records TEST.
Sources: [WalletPaymentsController.cs](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs) | [add-funds.tsx](../../../WebApp/src/add-funds.tsx) | [AddFunds.tsx](../../../InvestorApp/src/screens/AddFunds.tsx)

## yookassa-credit
Group: payments
RU: зачисление онлайн платежа
EN: online payment credit
Зачисление зависит от серверной проверки у провайдера. Ручное подтверждение YooKassa администратором заблокировано.
Credit depends on server-side provider verification. Manual admin confirmation of YooKassa payments is blocked.
Sources: [WalletPaymentsController.cs](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs) | [add-funds.tsx](../../../WebApp/src/add-funds.tsx) | [AddFunds.tsx](../../../InvestorApp/src/screens/AddFunds.tsx)

## bank-test
Group: payments
RU: тестовая банковская заявка
EN: test bank transfer request
Для банковской заявки TEST перевод денег не требуется. После одобрения сумма зачисляется на тестовый кошелёк.
A TEST bank request requires no transfer. Approval credits the test wallet.
Sources: [WalletPaymentsController.cs](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs) | [add-funds.tsx](../../../WebApp/src/add-funds.tsx) | [AddFunds.tsx](../../../InvestorApp/src/screens/AddFunds.tsx)

## bank-pending
Group: payments
RU: ожидающие платежи
EN: pending payment queue
Счётчик ожидающих платежей учитывает статусы requested и processing.
The pending payment count includes requested and processing.
Sources: [WalletPaymentsController.cs](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs) | [add-funds.tsx](../../../WebApp/src/add-funds.tsx) | [AddFunds.tsx](../../../InvestorApp/src/screens/AddFunds.tsx)

## bank-reject
Group: payments
RU: отклонение банковской заявки
EN: reject bank payment
Для отказа по ручной заявке требуется причина до 240 символов. История пополнений может её показать.
Rejecting a manual request requires a reason up to 240 characters. Funding history can display it.
Sources: [WalletPaymentsController.cs](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs) | [add-funds.tsx](../../../WebApp/src/add-funds.tsx) | [AddFunds.tsx](../../../InvestorApp/src/screens/AddFunds.tsx)

## payment-return
Group: payments
RU: возврат в приложение после оплаты
EN: android payment return
Android использует ownersclub://payments/return. Открытие ссылки само по себе не зачисляет средства.
Android uses ownersclub://payments/return. Opening that link does not credit funds by itself.
Sources: [OwnersClub-30.5.md](../../../docs/OwnersClub-30.5.md) | [WalletPayments.cs](../../../RealEstateInvestment/Services/WalletPayments.cs)

## manual-evidence
Group: evidence
RU: ручной платёж | ручной платеж | подтверждение платежа | чек
EN: manual payment | payment evidence
К открытой ручной заявке TEST можно приложить документ и комментарий. История привязана к заявке.
An open manual TEST request accepts a document and comment. History stays attached to the request.
Sources: [PaymentEvidenceController.cs](../../../RealEstateInvestment/Controllers/PaymentEvidenceController.cs) | [OwnersClub-30.6.md](../../../docs/OwnersClub-30.6.md) | [payment-evidence.tsx](../../../WebApp/src/payment-evidence.tsx)

## evidence-format
Group: evidence
RU: формат файла подтверждения
EN: evidence file formats
Принимаются PDF, JPEG и PNG до 5 МиБ на файл. Backend проверяет тип и сигнатуру.
PDF, JPEG, and PNG are accepted up to 5 MiB per file. The backend checks type and signature.
Sources: [PaymentEvidenceController.cs](../../../RealEstateInvestment/Controllers/PaymentEvidenceController.cs) | [OwnersClub-30.6.md](../../../docs/OwnersClub-30.6.md) | [payment-evidence.tsx](../../../WebApp/src/payment-evidence.tsx)

## evidence-limits
Group: evidence
RU: лимиты вложений платежа
EN: payment attachment limits
Лимит заявки составляет пять файлов и 50 записей истории. Комментарий может содержать до 2000 символов.
A request can have five files and 50 history entries. A comment can contain up to 2,000 characters.
Sources: [PaymentEvidenceController.cs](../../../RealEstateInvestment/Controllers/PaymentEvidenceController.cs) | [OwnersClub-30.6.md](../../../docs/OwnersClub-30.6.md) | [payment-evidence.tsx](../../../WebApp/src/payment-evidence.tsx)

## evidence-clarify
Group: evidence
RU: уточнение по платежу
EN: payment clarification
Администратор может запросить уточнение без закрытия заявки. Пользователь дополняет существующую заявку.
An admin can ask for clarification without closing the request. The user adds information to the existing request.
Sources: [PaymentEvidenceController.cs](../../../RealEstateInvestment/Controllers/PaymentEvidenceController.cs) | [OwnersClub-30.6.md](../../../docs/OwnersClub-30.6.md) | [payment-evidence.tsx](../../../WebApp/src/payment-evidence.tsx)

## evidence-access
Group: evidence
RU: доступ к платежному документу
EN: payment document access
Документ доступен владельцу или администратору после проверки прав. В Demo доступ закрыт.
An access check limits documents to the owner or an admin. Demo access is blocked.
Sources: [PaymentEvidenceController.cs](../../../RealEstateInvestment/Controllers/PaymentEvidenceController.cs) | [OwnersClub-30.6.md](../../../docs/OwnersClub-30.6.md) | [payment-evidence.tsx](../../../WebApp/src/payment-evidence.tsx)

## evidence-credit
Group: evidence
RU: зачисление после загрузки чека
EN: credit after evidence upload
Загрузка чека пополняет историю. Зачисление выполняется отдельной операцией проверки платежа.
Uploading evidence adds a history entry. Credit requires a separate payment review operation.
Sources: [PaymentEvidenceController.cs](../../../RealEstateInvestment/Controllers/PaymentEvidenceController.cs) | [OwnersClub-30.6.md](../../../docs/OwnersClub-30.6.md) | [payment-evidence.tsx](../../../WebApp/src/payment-evidence.tsx)

## withdraw-request
Group: withdrawals
RU: заявка на вывод | вывести деньги | вывод средств | как вывести деньги
EN: withdrawal request | withdraw money | withdraw funds | cash out
Нужна положительная сумма USD с максимум двумя знаками после запятой. Сервер проверяет остаток кошелька.
A positive USD amount with at most two decimal places is required. The server checks the wallet balance.
Sources: [WithdrawalController.cs](../../../RealEstateInvestment/Controllers/WithdrawalController.cs) | [WithdrawScreen.tsx](../../../InvestorApp/src/screens/WithdrawScreen.tsx)

## withdraw-test
Group: withdrawals
RU: тестовый вывод
EN: test withdrawal destination | test withdrawal
В тестовом сценарии требуется UUID запроса и назначение TEST-BANK-001.
The test scenario requires a request UUID and destination TEST-BANK-001.
Sources: [WithdrawalController.cs](../../../RealEstateInvestment/Controllers/WithdrawalController.cs) | [WithdrawScreen.tsx](../../../InvestorApp/src/screens/WithdrawScreen.tsx)

## withdraw-cancel
Group: withdrawals
RU: отмена вывода
EN: cancel withdrawal
Владелец может отменить ожидающую заявку. Сумма возвращается в кошелёк.
The owner can cancel a pending request. The amount returns to the wallet.
Sources: [WithdrawalController.cs](../../../RealEstateInvestment/Controllers/WithdrawalController.cs) | [WithdrawScreen.tsx](../../../InvestorApp/src/screens/WithdrawScreen.tsx)

## withdraw-reject
Group: withdrawals
RU: отказ по выводу
EN: withdrawal rejection
Для отказа по ожидающей заявке требуется причина до 240 символов. Сумма возвращается в кошелёк.
Rejecting a pending request requires a reason up to 240 characters. The amount returns to the wallet.
Sources: [WithdrawalController.cs](../../../RealEstateInvestment/Controllers/WithdrawalController.cs) | [WithdrawScreen.tsx](../../../InvestorApp/src/screens/WithdrawScreen.tsx)

## withdraw-history
Group: withdrawals
RU: история выводов
EN: withdrawal history
История требует проверки владельца или администратора. В Demo маршрут читает виртуальные выводы.
History requires an owner or admin check. Demo reads simulated withdrawals.
Sources: [WithdrawalController.cs](../../../RealEstateInvestment/Controllers/WithdrawalController.cs) | [WithdrawScreen.tsx](../../../InvestorApp/src/screens/WithdrawScreen.tsx)

## rent-income
Group: rent
RU: история арендного дохода | арендные начисления | мои начисления аренды
EN: rental income history | rent income history | my rental income
Инвестор может просматривать историю арендных начислений. В Android предусмотрен отдельный экран.
Investors can view their rental income history on a dedicated Android screen.
Sources: [RentalIncomeController.cs](../../../RealEstateInvestment/Controllers/RentalIncomeController.cs) | [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs) | [MyRentIncomeScreen.tsx](../../../InvestorApp/src/screens/MyRentIncomeScreen.tsx)

## rent-payout
Group: rent
RU: начисление аренды по объекту
EN: property rent payout
Административная операция начисления аренды выполняется для конкретного объекта.
The administrative rent distribution operation is scoped to a property.
Sources: [RentalIncomeController.cs](../../../RealEstateInvestment/Controllers/RentalIncomeController.cs) | [UserController.cs](../../../RealEstateInvestment/Controllers/UserController.cs) | [MyRentIncomeScreen.tsx](../../../InvestorApp/src/screens/MyRentIncomeScreen.tsx)

## rent-property-history
Group: rent
RU: история аренды объекта
EN: property rent history
История аренды запрашивается для отдельного объекта и имеет отдельный экран в Android.
Rent history is retrieved per property and has a dedicated Android screen.
Sources: [PropertyController.cs](../../../RealEstateInvestment/Controllers/PropertyController.cs) | [RentHistoryScreen.tsx](../../../InvestorApp/src/screens/RentHistoryScreen.tsx)

## club
Group: club
RU: club | клуб | статус клуба | комиссия клуба
EN: club | club status
Сведения Club включают расчётную стоимость активов, статус и ставки комиссии.
Club information contains calculated asset value, tier, and fee rates.
Sources: [ShareOfferController.cs](../../../RealEstateInvestment/Controllers/ShareOfferController.cs) | [UserFeeHelper.cs](../../../RealEstateInvestment/Helpers/UserFeeHelper.cs)

## club-thresholds
Group: club
RU: пороги клуба
EN: club tier thresholds
Пороги Expert, Visionary и VIP составляют 10 000, 50 000 и 100 000. Ниже первого порога действует Explorer.
Expert, Visionary, and VIP thresholds are 10,000, 50,000 and 100,000. Explorer applies below the first threshold.
Sources: [ShareOfferController.cs](../../../RealEstateInvestment/Controllers/ShareOfferController.cs) | [UserFeeHelper.cs](../../../RealEstateInvestment/Helpers/UserFeeHelper.cs)

## club-referral-fee
Group: club
RU: реферальная ставка клуба
EN: club referral fee
Сведения Club показывают базовые и реферальные ставки отдельно.
Club information shows base and referral rates separately.
Sources: [ShareOfferController.cs](../../../RealEstateInvestment/Controllers/ShareOfferController.cs) | [UserFeeHelper.cs](../../../RealEstateInvestment/Helpers/UserFeeHelper.cs)

## referral
Group: referral
RU: referral | реферал | реферальный код | приглашение
EN: referral | referral invite
Выпуск и активация кода выполняются отдельно. При активации сервер проверяет статус и срок приглашения.
Issuing and redeeming are separate operations. Redemption checks the invite status and expiry.
Sources: [ReferralsController.cs](../../../RealEstateInvestment/Controllers/ReferralsController.cs) | [ReferralInvite.cs](../../../RealEstateInvestment/Models/ReferralInvite.cs)

## referral-cost
Group: referral
RU: стоимость приглашения
EN: referral invite cost
Для выпуска сервер проверяет право пригласить и баланс для списания 10 USD.
Issuing an invite checks eligibility and sufficient balance for a 10 USD charge.
Sources: [ReferralsController.cs](../../../RealEstateInvestment/Controllers/ReferralsController.cs) | [ReferralInvite.cs](../../../RealEstateInvestment/Models/ReferralInvite.cs)

## referral-history
Group: referral
RU: мои приглашения
EN: my referral invites
Отдельный список показывает выпущенные приглашения текущего пользователя.
A dedicated list shows invites issued by the current user.
Sources: [ReferralsController.cs](../../../RealEstateInvestment/Controllers/ReferralsController.cs) | [ReferralInvite.cs](../../../RealEstateInvestment/Models/ReferralInvite.cs)

## demo
Group: demo
RU: demo | демо | демо режим
EN: demo | demo account
Demo использует отдельные записи кошелька, инвестиций и заявок. Доступ зависит от активности и срока Demo-аккаунта.
Demo uses separate wallet, investment and application records. Access depends on account activity and expiry.
Sources: [FinancialActor.cs](../../../RealEstateInvestment/Helpers/FinancialActor.cs) | [DemoWalletController.cs](../../../RealEstateInvestment/Controllers/DemoWalletController.cs) | [AssistantController.cs](../../../RealEstateInvestment/Controllers/AssistantController.cs)

## demo-topup
Group: demo
RU: пополнение демо кошелька
EN: demo wallet topup
Пополнение Demo симулируется и меняет отдельный Demo-баланс.
Demo top-ups are simulated and change the separate Demo balance.
Sources: [FinancialActor.cs](../../../RealEstateInvestment/Helpers/FinancialActor.cs) | [DemoWalletController.cs](../../../RealEstateInvestment/Controllers/DemoWalletController.cs) | [AssistantController.cs](../../../RealEstateInvestment/Controllers/AssistantController.cs)

## demo-withdraw
Group: demo
RU: демо вывод
EN: demo withdrawal
При достаточном Demo-балансе вывод завершается сразу со статусом simulated.
With sufficient Demo balance, a withdrawal completes immediately with status simulated.
Sources: [WithdrawalController.cs](../../../RealEstateInvestment/Controllers/WithdrawalController.cs)

## demo-admin
Group: demo
RU: управление демо аккаунтами
EN: manage demo accounts
Администратор может создать, сбросить или изменить активность Demo-аккаунта.
An admin can create, reset, or change the active state of a Demo account.
Sources: [AdminDemoAccountsController.cs](../../../RealEstateInvestment/Controllers/AdminDemoAccountsController.cs)

## support-chat
Group: support
RU: чат поддержки | написать в поддержку | связь с поддержкой
EN: support chat | contact support | chat with support
Для двусторонней переписки предусмотрен чат. Backend проверяет доступ к диалогу.
Two-way support uses chat. The backend checks access to the conversation.
Sources: [ChatController.cs](../../../RealEstateInvestment/Controllers/ChatController.cs) | [ChatScreen.tsx](../../../InvestorApp/src/screens/ChatScreen.tsx)

## chat-empty
Group: support
RU: пустое сообщение чата
EN: empty chat message
Backend отклоняет пустое сообщение или сообщение из одних пробелов.
The backend rejects empty or whitespace-only messages.
Sources: [ChatController.cs](../../../RealEstateInvestment/Controllers/ChatController.cs) | [ChatScreen.tsx](../../../InvestorApp/src/screens/ChatScreen.tsx)

## chat-demo
Group: support
RU: чат в демо
EN: demo support chat
Отправка в живой чат отключена для Demo. История возвращается пустой.
Live chat sending is disabled in Demo. Chat history is empty.
Sources: [ChatController.cs](../../../RealEstateInvestment/Controllers/ChatController.cs) | [ChatScreen.tsx](../../../InvestorApp/src/screens/ChatScreen.tsx)

## inbox
Group: support
RU: входящие сообщения | сообщения администратора
EN: inbox messages | admin messages
Входящие административные сообщения имеют собственный счётчик непрочитанных и отдельный маршрут от чата.
The administrative inbox has its own unread count and a separate endpoint from chat.
Sources: [MessageController.cs](../../../RealEstateInvestment/Controllers/MessageController.cs) | [InboxNotifications.tsx](../../../InvestorApp/src/components/InboxNotifications.tsx) | [OwnersClub-30.6.md](../../../docs/OwnersClub-30.6.md)

## notifications
Group: support
RU: уведомления пользователя
EN: user notifications
Список уведомлений доступен владельцу. В Demo список пуст.
The account owner can list notifications. Demo returns an empty list.
Sources: [NotificationController.cs](../../../RealEstateInvestment/Controllers/NotificationController.cs)

## notification-read
Group: support
RU: прочитать уведомление
EN: mark notification read
Можно отметить своё уведомление прочитанным. Сервер проверяет принадлежность записи.
Users can mark their own notifications as read. The server checks record ownership.
Sources: [NotificationController.cs](../../../RealEstateInvestment/Controllers/NotificationController.cs)

## push-token
Group: support
RU: регистрация пуш уведомлений
EN: register push notifications
Приложение может зарегистрировать push-токен через авторизованный маршрут. В Demo регистрация закрыта.
The app can register a push token through an authenticated endpoint. Registration is blocked in Demo.
Sources: [NotificationController.cs](../../../RealEstateInvestment/Controllers/NotificationController.cs)

## assistant-auth
Group: security
RU: доступ к ассистенту
EN: assistant authentication
Для доступа нужен действующий JWT с ролью investor и признаком Demo. Backend проверяет состояние аккаунта.
Access requires a valid JWT with the investor role and Demo marker. The backend checks account state.
Sources: [AssistantController.cs](../../../RealEstateInvestment/Controllers/AssistantController.cs) | [AssistantRegistration.cs](../../../RealEstateInvestment/Services/Assistant/AssistantRegistration.cs)

## assistant-rate
Group: security
RU: лимит вопросов ассистента
EN: assistant rate limit
Для всех маршрутов ассистента действует общий лимит 12 запросов в минуту на аккаунт и контур на экземпляр сервера.
All assistant routes share a limit of 12 requests per minute per account and environment on each server instance.
Sources: [AssistantController.cs](../../../RealEstateInvestment/Controllers/AssistantController.cs) | [AssistantRegistration.cs](../../../RealEstateInvestment/Services/Assistant/AssistantRegistration.cs)

## assistant-input
Group: security
RU: длина вопроса ассистента
EN: assistant question length
Поле вопроса ограничено 400 символами, тело запроса 4096 байтами.
The question field is limited to 400 characters and the request body to 4,096 bytes.
Sources: [AssistantController.cs](../../../RealEstateInvestment/Controllers/AssistantController.cs) | [AssistantRegistration.cs](../../../RealEstateInvestment/Services/Assistant/AssistantRegistration.cs)

## session-refresh
Group: security
RU: обновление сессии
EN: refresh session
Для обновления сессии предусмотрен отдельный маршрут refresh.
Session renewal uses a dedicated refresh endpoint.
Sources: [AuthController.cs](../../../RealEstateInvestment/Controllers/AuthController.cs)

## session-logout
Group: security
RU: выход из аккаунта
EN: sign out
Backend предоставляет отдельный маршрут logout.
The backend provides a dedicated logout endpoint.
Sources: [AuthController.cs](../../../RealEstateInvestment/Controllers/AuthController.cs)

## admin-roles
Group: admin
RU: изменение роли пользователя
EN: change user role
Роль и дополнительные разрешения изменяются отдельными административными операциями.
Roles and additional permissions are changed by separate admin operations.
Sources: [AdminController.cs](../../../RealEstateInvestment/Controllers/AdminController.cs)

## admin-reset-pin
Group: admin
RU: сброс пин администратором
EN: admin pin reset
Для сброса PIN администратором предусмотрена отдельная операция.
Admins have a dedicated PIN reset operation.
Sources: [AdminController.cs](../../../RealEstateInvestment/Controllers/AdminController.cs)

## admin-payment-queue
Group: admin
RU: админская очередь платежей
EN: admin payment queue
Очередь платежей и её счётчик проверяют актуальные права администратора.
The payment queue and its counter check current admin permissions.
Sources: [WalletPaymentsController.cs](../../../RealEstateInvestment/Controllers/WalletPaymentsController.cs)
