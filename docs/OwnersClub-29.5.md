# OwnersClub 29.5 — wallet payments

The existing Add Funds route and Android screen use one `/api/payments` contract. Payment IDs and idempotency keys are generated and persisted by the clients. Cards are entered only on the PSP-hosted checkout. The former local Add Card form now directs users to Add Funds; the legacy fake-success simulate endpoint returns 410.

## Accounting

Each request freezes charge amount/currency, fee, wallet currency, conversion rate, wallet credit, test flag, method and return URL. Fee is deducted from the charge before conversion. Fees round to charge cents, away from zero; wallet credit rounds down to wallet cents. Conversion remainder is exposed and audited separately. Example fixture: 200 RUB, 2.5% fee, 80 RUB/USD gives fee 5 RUB, credit 2.43 USD and conversion remainder 0.60 RUB. These fixtures are not market exchange rates.

The current wallet is denominated in USD and the YooKassa charge currency is RUB. No other wallet currency is enabled. Provider GET verification must match ID, shop, test flag, correlation, amount, currency and paid status. A database compare-and-set, wallet increment, Deposit and settlement ActionLog commit together. Replays do not credit again. Provider errors retain the original attempt. Creation retries stop before YooKassa's 24-hour idempotency window expires.

Returning from checkout never directly credits a wallet. Android uses Linking and `ownersclub://payments/return`, followed by authenticated polling; foreground recovery also works when the user switches back manually. A cold start restores the saved attempt after session loading.

## Requests and administration

Methods: online YooKassa, invoice/payment-link request, bank transfer and payment assistance. Creating a manual request changes no balance. Users see their own payment history and request statuses. `/admin/payments` provides the review interface; the server rechecks the current database admin role, confirmation and blocked/deleted state.

An administrator can start processing, provide a PSP-hosted HTTPS link, reject a request or confirm independently verified receipt. Confirmation requires exact received amount and currency, an explicit verification flag, and a unique normalized statement reference. Reference reuse, journal failure or concurrent settlement cannot leave a partial wallet credit. Online YooKassa payments cannot be manually confirmed by this API. No user screenshot/upload or card-data field is provided. Bank instructions must be supplied through trusted configuration; they are not fabricated.

History/queue endpoints currently return the latest 100 records; older rows remain in the database. Admin review is available in WebApp; Android includes the user request interface and history.

## Configuration and storage

Use protected Render environment variables under `Payments__`. Do not commit secrets.

| Setting | Current test configuration |
| --- | --- |
| Enabled | true when validated for test use |
| TestMode | true |
| AllowLivePayments | false |
| ShopId | 1514010 |
| SecretKey | existing test key from protected local configuration |
| ReturnUrl | https://wamsoc.com/top-up |
| MobileReturnUrl | ownersclub://payments/return |
| ChargeCurrency / WalletCurrency | RUB / USD |
| ChargeUnitsPerWalletUnit | 100, explicitly a test conversion |
| FeePercent | 0 |
| MinAmount / MaxAmount | 1 / 10000 |
| BankInstructions | set only to verified beneficiary instructions |

There is no rate default in the payment mechanism. A future live shop requires separate explicit configuration including `TestMode=false`, `AllowLivePayments=true`, a live shop and a matching key. This is configuration support, not acceptance for real payments; live fiscalization, operational reconciliation and real-money acceptance remain separate work.

The existing `SandboxPayments` table and `AmountRub` column names are retained as storage mappings so that 29.4 history is not lost. Migration `20261030150247_WalletPaymentQuotesAndReview295` adds quote/review fields and one unique reference index. Its only backfill preserves the existing test payment's quote; it does not change wallets or ledger rows. Do not run a destructive Down migration after payment activity.

## Deployment and acceptance

Keep `BackgroundJobs__Enabled=false` and Auto-Deploy OFF. Use a specific tested commit. Back up PostgreSQL before applying the additive migration. The runtime does not need a separate sandbox service or BackgroundJobs.

Configure only `payment.succeeded` and `payment.canceled` in test shop 1514010, with `https://sell-estate.onrender.com/api/payments/webhook`. The original `/api/payments/yookassa-sandbox/webhook` URL remains an alias; configure only one delivery destination. Verify a newly completed hosted test payment, external delivery, one Deposit and one settlement ActionLog, then repeat notifications and compare balances. API polling or a locally replayed webhook does not prove external delivery.

Preserve old payment attempts and audit rows for reconciliation. Clean up only deliberately created QA fixtures, after comparing the control snapshot. Do not reset other users or their balances. The deployment report records actual commit/live SHA, publication state, tests, financial snapshots and blocked acceptance items separately.

Official references: [YooKassa notifications](https://yookassa.ru/developers/using-api/webhooks), [payment process and hosted redirect](https://yookassa.ru/developers/payment-acceptance/getting-started/payment-process), [testing](https://yookassa.ru/developers/payment-acceptance/testing-and-going-live/testing), [React Native Linking](https://reactnative.dev/docs/linking).
