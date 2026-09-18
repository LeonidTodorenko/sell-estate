# WebApp Live Production QA — Pass 1

Date: 2026-09-18  
Target: https://wamsoc.com (Cloudflare Worker `shiny-recipe-087`)  
API base: https://sell-estate.onrender.com/api

## Scope and safety

Read-only production QA. No source files, backend, mobile app, deployment, git commit, or push changed. No real financial operations were attempted. No account was created, no password was changed, no reset email was sent, and no chat message or profile data was submitted. Demo login and Demo Top Up were not attempted because credentials were not available in the session.

## PASS/FAIL matrix

| Area | Result | Evidence / limitation |
|---|---|---|
| Deployment `/` | PASS | HTTP 200, SPA shell loaded |
| Public routes `/login`, `/register`, `/forgot-password` | PASS | Direct navigation returned HTTP 200 and correct UI |
| Direct refresh / SPA fallback | PASS | `/register` reload remained on route with form intact |
| Public informational routes | PASS | `/about`, `/privacy`, `/terms`, `/support` rendered |
| Protected route gating | PASS | `/dashboard`, `/properties`, `/marketplace` redirected to `/login` |
| Assets / console | PASS | Shell and UI loaded; no browser console warnings/errors observed |
| Register validation/CAPTCHA | PARTIAL PASS | CAPTCHA initially showed `Loading…` and controls disabled briefly; after reload it became `1 + 6`, input/button enabled. POST intentionally not submitted |
| Forgot/reset | PARTIAL | UI route verified; reset request not submitted to avoid sending email |
| Normal authenticated flows | NOT TESTED | No approved test credentials available |
| Demo flows / Monthly Reports / Demo Top Up | NOT TESTED | No demo credentials available; no write performed |
| Responsive mobile (390px) | PASS (smoke) | Register at 390px viewport had `scrollWidth == clientWidth` (375 CSS px), no horizontal overflow |
| Desktop ~1440px | PARTIAL | Public route smoke checked in default desktop viewport; exact 1440 override not required for observed shell |
| API compatibility | PARTIAL | `GET https://sell-estate.onrender.com/api` returned 404; base root is not a documented resource endpoint. No authenticated API calls possible without credentials |

## New defects

No reproducible production regression defects confirmed in this pass.

Transient observation: on first load of `/register`, CAPTCHA displayed `Loading…`, the answer field was disabled, and Create account/Refresh CAPTCHA were disabled. After a page reload the CAPTCHA rendered as `1 + 6`, controls enabled, and the route remained functional. Treat as a possible slow-loading UX issue only if it persists beyond normal load time; not classified as a confirmed bug.

## Known TODOs (excluded from new bugs)

- Production password hashing migration pending.
- Change Password remains disabled due to demo hash/backend issue.
- Confirmation/reset/referral links may still use `todtech.ru`/API until migration.
- Financial writes remain intentionally disabled except Demo Top Up.

## Not checked and why

Authenticated investor pages (Dashboard, Properties details, Investments, Finance, Transactions, Marketplace private actions, KYC, Inbox/Chat, Profile, Club/Referrals, Withdrawals) require existing credentials. No credentials were guessed or entered. Demo isolation, Monthly Reports, and Demo Top Up require demo credentials and were therefore skipped. CAPTCHA solving, registration POST, reset email POST, document upload, and all financial writes were intentionally skipped for safety.

## Recommendation for next fix iteration

No fix iteration is justified from confirmed defects. First obtain approved normal and demo test credentials, then rerun authenticated and demo matrices. Separately consider adding a visible loading timeout/retry message for CAPTCHA if telemetry shows prolonged `Loading…` states.

## Writes performed

None.
