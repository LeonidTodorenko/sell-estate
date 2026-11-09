# OwnersClub 30.3.1 — release candidate

SuperUser bootstrap assigns a unique nine-character ClientNumber using the existing generator and a uniqueness query. Existing users and the Production bootstrap guard are unchanged. PostgreSQL regression migrates a newly created empty database, creates an admin, replays startup, creates a second admin, and verifies existing account values and unique client numbers.

Validation: backend 355 passed, zero failed/skipped; WebApp 49 tests and production build passed; local Android 34 tests/typecheck passed; isolated release Android 26 tests/typecheck passed (unrelated 30.1 tests excluded). Android UI SKIPPED: no connected device; no APK built.

App/Data SHA256: 31/31 full-file matches. Local 30.1/30.2 edits and appsettings.json are retained and excluded from the selective release. Two Android release files deliberately omit unrelated local account-cache and picker-style edits.

Wallet operations tests cover bank approval credit/journal/audit exactly once, rejection reason, reserve/refund, competing withdrawal decisions and cancellations, atomic rollback, JWT and owner/admin checks. Prior 22-screen WebApp QA is historical, not rerun as live UI in this iteration.

## Deployment sequence

1. Verify Render sell-estate and Cloudflare wamsoc.com project identity and access. Keep BackgroundJobs OFF, YooKassa test shop only, preserve secrets.
2. Existing fresh Render test DB backup is private at C:/App/work/wallet3031/predeploy.dump; archive readability and local restore verified. Do not upload this archive publicly.
3. Check remote migration history and pending withdrawal request key compatibility before applying WalletOperations303.sql. Apply only this additive migration. It was tested against a restored backup and replayed locally successfully. Do not execute Down (it drops columns).
4. Push the selective candidate commit only when backend deployment can be observed; pushing may trigger automatic Render deployment. Deploy that commit and confirm Live version, startup, BackgroundJobs OFF and API health.
5. Upload WebApp archive contents to the existing Cloudflare static-assets project; preserve SPA routing and existing configuration. No DNS or secret changes.
6. Verify synthetic investor/admin flows against the published API and confirm actual deployed backend SHA and WebApp asset hash. Do not perform production payouts.

Current status: no push, no remote migration and no deployment in this iteration. Publication awaits user-opened authenticated service pages. Actual running remote versions have not been verified.
