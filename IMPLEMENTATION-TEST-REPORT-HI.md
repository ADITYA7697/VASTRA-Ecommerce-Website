# VASTRA — Final implementation & test report

## Implemented in this build
- Existing email/password authentication retained; JWTs now include and verify issuer/audience with HS256.
- Google sign-in server token validation and Twilio Verify SMS OTP endpoints retained; provider credentials are required.
- Razorpay online checkout backend endpoints added (create provider order, verify signature, query payment status and captured amount).
- Razorpay payment intent persists the server-calculated cart snapshot and shipping address; checkout does not trust the client total.
- Payment verification is idempotent by payment ID, stock reservation is guarded by stock quantity, and successful payment creates a paid order.
- Checkout now offers COD and online payment; online option is disabled when payment configuration is unavailable.
- No real credentials or `.env` file are included.

## Automated checks performed
- `node backend/scripts/check.js`: PASS — syntax checks for 28 backend JavaScript files.
- `node --check frontend/js/script.js`: PASS.
- ZIP archive integrity check: recorded during packaging.

## Not claimed / needs environment-backed validation
- MongoDB integration and full API/browser end-to-end checkout were not run in this environment.
- Google OAuth, SMS delivery, and Razorpay payments require the user's own provider credentials and dashboard setup; no live or test transaction was executed here.
- Production password-reset email delivery is not configured. Reset token is only exposed in development; production currently logs a warning and sends no email.
- Before live payment launch, run Razorpay Test Mode scenarios (success, cancel, failure, duplicate verification, stock race, cart changes), enable HTTPS, set up webhook reconciliation/refunds, and verify tax/shipping/legal policies.

## Required environment values
- `JWT_SECRET`: unique random secret, 32+ characters.
- `MONGO_URI`, exact `FRONTEND_ORIGIN`.
- Google: `GOOGLE_CLIENT_ID` (optional if not using Google sign-in).
- SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` (optional if not using SMS OTP).
- Online payment: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (use Test Mode keys first).


## Authentication UI update in this patch
- Customer login UI now presents only Email + Password (primary) and Mobile + Password (secondary); customer-facing OTP login/signup UI was removed from the login/signup pages.
- Signup now uses name + email + password.
- Mobile + Password backend login accepts only a verified phone number linked to an account that has a password. OTP endpoints remain in backend code for possible future use, but are not presented as customer login options in this UI.
- My Orders and the existing 7-day return request flow are preserved.
- Mobile login requires an already verified phone number and does not automatically create/verify phone identities.


## Follow-up implementation (Nov 2026)
- Added server-side Coupon model and admin CRUD endpoints. Built-in `VASTRA20` (first order, 20%) and `OLD10` (account age 365+ days, 10%) are created automatically; eligibility is checked against account/order records on the server.
- Coupon code and discount are stored on COD and Razorpay orders; Razorpay payment intent amount includes server-calculated discount. Coupon application UI added to checkout.
- Added protected endpoint to create admins and change user roles; admin dashboard UI now includes coupon management and create-admin form. Removed displayed demo admin credentials. First admin is created through `npm run seed:admin` using private values in `backend/.env`.
- Customer phone/password login now checks the password for the phone linked to the account without requiring OTP at login. Signup already checks confirm-password in the browser and now also checks duplicate phone at registration.
- Tests rerun after changes: syntax checks pass for 47 backend JS files; existing unit suite 40/40 pass. These unit tests are largely pre-existing and do not prove MongoDB/browser/provider end-to-end behavior. MongoDB integration, real signup/login, coupon checkout, admin login, and Razorpay transaction were not run because this environment has no configured customer database/provider credentials.
- Limitation: coupon use counters are incremented after successful order creation; highly concurrent coupon max-use limits would need an atomic reservation strategy for strict enforcement.
