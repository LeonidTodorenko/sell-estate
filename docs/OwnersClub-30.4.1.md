# OwnersClub 30.4.1

Full ready-source integration over main 01b32ede82d1548eaba9f6062fc00d6d13290463. Retains 30.1 lightweight Android/account-cache fixes, 30.2 Samsung payment picker, 30.3/30.3.1 wallet operations and 30.4 PaymentPlan/manual investment workflow. No APK build or store publication.

## Agreed settlement rules

- At DueDate, each stage uses Paid plus its pending/carried reservations against Total. A funded queue is accepted in full; reservations are not debited again.
- Underfunded queues are rejected and their original reserves returned. This applies to the first and all later stages.
- Previously accepted/partial investments and their shares are untouched. Property status is never changed by application settlement.
- Carry is an explicit administrator decision. The scheduler never moves a reservation to another stage.
- Sources must match a unique original investment debit. Missing/ambiguous/already-settled sources stop the property's transaction and create one durable reconciliation conflict, visible to administrators. No guessed refunds.
- One Serializable transaction settles all due queues of a property, including investments, Paid, wallet, capacity, UserTransactions, ActionLogs and internal messages. A conflict/failure rolls it all back. Stable decision/refund IDs and terminal statuses prevent repeated effects. External push is attempted only after commit and is not an exactly-once notification guarantee.
- Administrators retain accept/partial/reject/carry/atomic stage acceptance. Shared reserve validation and PostgreSQL serialization protect admin/scheduler races. Legacy unsafe endpoints remain HTTP 410.

## Release and activation

1. Run PostgreSQL regression, scheduler startup/concurrency/rollback tests, WebApp tests/build and Android tests/typecheck. Review explicit file allowlist and additions for secrets. Exclude appsettings.json, environment files, binaries, temporary QA app entrypoints/resolvers and unfinished/unrelated files. Do not use git add -A or force push.
2. Read-only test-server preflight in one consistent transaction: inspect all pending/carried, their source evidence, stage schedules and planned effects; inspect expired offers and demo monthly first-pass effects. Stop for a user decision if new historical processing appears. Do not create a PostgreSQL dump or backup. Without a backup, read-only comparisons detect changes but do not restore an erroneous mutation.
3. Push main and deploy the exact verified backend commit with BackgroundJobs OFF first. Confirm /health release=30.4.1 and commit. Publish the WebApp assets to the existing wamsoc.com service, preserving routing and configuration. Keep YooKassa TEST settings and all secrets unchanged.
4. Repeat preflight immediately before enabling BackgroundJobs__Enabled=true. It registers ScheduledTaskService, MonthlyReportsHostedService and DemoMonthlyHostedService. Application settlement starts immediately, then every five minutes. Monthly reports run on their existing schedule; demo monthly processing starts immediately and remains separate from investor funds.
5. Verify /health backgroundJobsEnabled=true, schedulerMode=due-stage-settlement and the exact commit. Observe scheduler tick start/completion and reconcile the first pass against preflight. Perform controlled test-user finance/e2e fixtures, compare original reserves, refunds, ownership, stage Paid and audit counts, and inspect repeat execution. Never perform real payouts.
6. If verification fails, disable BackgroundJobs before any code rollback. Do not remove financial journals or assume that reverting code reverses committed financial effects; investigate and reconcile affected fixtures explicitly.

All commands, tests, Git and deployment run under C:/App. C:/Data/sell_estate/sell-estate is a source mirror only: copying and SHA256. Preserve pre-existing local files and both copies; local QA diagnostics may remain in the working copies while being omitted from the release commit.
