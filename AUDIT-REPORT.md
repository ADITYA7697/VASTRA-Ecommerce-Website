# VASTRA — Audit Report & Checklist

Scope of this pass: Phase 1 (audit) and Phase 2 (mobile number as primary login). The task brief ended mid-sentence inside Phase 2 (at "implement appropriate CSRF protection for…") and later phases were not received, so nothing beyond Phase 2 was started. See *Not done* below.

## How this was verified (and what was not)
| Layer | Status |
|---|---|
| Phone normalisation, cookie/CSRF helpers, OTP cooldown/lockout | **Run: 19 unit tests pass** |
| Register / login / link controllers, session + CSRF middleware | **Run: 21 unit tests pass** against an in-memory stand-in for the User model and a minimal JWT stub. Mutation-checked: removing the CSRF check, matching unverified phones, or creating the account before OTP success each makes tests fail. |
| Login, signup, profile, logout, expiry in a real browser (Chromium) | **Run: 19 checks pass** against a stand-in API, not the real backend |
| `node --check` on all 43 JS files; all 30 backend modules load | **Run: pass** |
| Real Express + MongoDB + Mongoose index behaviour | **NOT run.** This workspace blocks the npm registry and MongoDB downloads, so dependencies could not be installed. `tests/integration/auth.flow.test.js` is written for this but has never been executed. |
| Twilio SMS, Google Sign-In, Razorpay | **NOT tested** — need your credentials and network access. |

Treat the new auth as *implemented and logic-tested, not yet proven end-to-end* until `npm install && npm test && npm run test:integration` pass on your machine.

## Findings fixed in this pass
| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | `email` was `required` + non-partial unique, so email-less accounts were impossible; old phone login invented fake `@phone.vastra.invalid` emails | High (blocks requirement) | Optional email; partial unique indexes; `migrate:auth` clears placeholders; they are also hidden from API output |
| 2 | OTP login looked up users by `phone` regardless of verification → a number typed (unverified) into someone's profile let whoever verified that number log into that account | High (account takeover) | Login/uniqueness use **verified** numbers only |
| 3 | `POST /auth/login` on a passwordless account called `bcrypt.compare(pw, undefined)` → HTTP 500 | Medium | Constant-time compare against a generated dummy hash → clean 401 |
| 4 | JWT returned in JSON and stored in `localStorage` (readable by any XSS) | High | HttpOnly cookie, no token in bodies/storage; CSRF token + Origin check; `Authorization: Bearer` still accepted for API clients |
| 5 | Profile `PUT` saved any phone string unverified | Medium | Normalised/validated; a verified number can only change via OTP |
| 6 | Mobile/Google login did not migrate the guest cart | Medium | Shared `migrateGuestCart` after every login method; waits for catalog load |
| 7 | Password reset left existing sessions valid | Medium | `tokenVersion` revokes all sessions (also `POST /auth/logout-all`) |
| 8 | OTP limits were per-IP only | Medium | Per-number 30 s cooldown, 5 sends/hour, 5-wrong-guess lockout (in-process; use Redis/Mongo if you run several instances) |
| 9 | Support form decided "logged in?" by the presence of an `Authorization` header — would silently treat cookie sessions as guests | Medium | `optionalAuth` middleware |
| 10 | `/auth/login` limited to 100 tries per 15 min | Low | 20 |
| 11 | No `trust proxy` setting → IP rate limits useless behind a reverse proxy | Low | `TRUST_PROXY` env |
| 12 | Profile/checkout phone inputs `maxlength=10` conflicted with E.164 | Low | Removed |
| 13 | Admin lists showed blank for email-less users | Low | Fall back to phone |

## Open findings (not fixed — need your decision or later phases)
| Finding | Severity |
|---|---|
| **Razorpay has no webhook.** The order is created only when the browser calls `/payments/razorpay/verify`. If the customer pays and closes the tab, money is captured with no order. | High |
| No Coupon model/routes exist although the brief lists coupons. | Missing feature |
| Shipping rule (free ≥ ₹999 else ₹79) is duplicated in `orderController`, `paymentController` and the frontend — move to one config. | Medium |
| COD order stock decrement has no transaction (compensating rollback only). | Low–Med |
| Support tickets require an email; phone-only customers must type one. | Low |
| Profile DOB/gender inputs are never saved (the fields now exist in the schema but `PUT /auth/profile` does not write them). | Low |
| Google Client ID is hard-coded in `auth-methods.js`; better served from the API. Google Sign-In unconfigured. | Low |
| No password-reset email provider (dev returns the token in the response; production only logs). Mobile accounts recover via OTP, so this only affects legacy email users. | Medium |
| No `package-lock.json`; no CI. | Low |
| Admin login is password-only (no 2FA). | Medium |
| Checkout/Razorpay front-end code, product/cart/admin routes were read for auth issues only, not audited in depth. | — |

## Blockers on your side
- Twilio Verify credentials (and DLT registration for India) before any real SMS.
- A MongoDB instance to run the integration test and the migration.
- Rotate the previously leaked MongoDB/JWT/admin secrets mentioned in the README, if not already done.

## Feature checklist (Phase 2)
- [x] Registration: name + mobile + OTP required, email optional
- [x] E.164 normalisation, country validation (13 countries; extendable)
- [x] Unique verified numbers (partial index) + safe handling of concurrent registration
- [x] Phone never marked verified before OTP success
- [x] Server-side validation; no hashes/OTPs/tokens in responses
- [x] OTP login → normal session; persists on refresh; logout clears cookie; expiry handled gracefully in UI
- [x] Existing email accounts keep working; can add a verified mobile; never merged/deleted
- [x] CSRF protection for cookie sessions
- [x] `.env.example` updated; `.env` untouched
- [ ] Verified against real MongoDB / Twilio (blocked in this workspace)
