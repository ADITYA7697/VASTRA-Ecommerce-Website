# VASTRA — Fixed Full-Stack Project

This package combines the storefront and the Express/MongoDB API in one project. The frontend has been wired to the backend for products, customer signup/login, profile updates, wishlist, account cart, COD orders, order history, and admin product management. Guest cart/wishlist use browser storage until the customer signs in.

## Requirements
- Node.js 18 or newer
- MongoDB Atlas or a reachable MongoDB instance

## Quick start (Windows PowerShell)
1. Extract this folder.
2. Open a terminal in `backend`.
3. Install packages:
   ```powershell
   npm install
   ```
4. Copy the environment template:
   ```powershell
   Copy-Item .env.example .env
   ```
5. Edit `backend/.env`: set `MONGO_URI`, a unique random `JWT_SECRET` (32+ characters), and strong `ADMIN_PASSWORD`. Keep `.env private; do not upload it.
6. Start the server:
   ```powershell
   npm run dev
   ```
7. Open `http://localhost:5000` (not the Live Server port 5500). The backend serves the frontend and API from one origin, avoiding API/CORS mismatches.
8. In another terminal from `backend`, seed the sample products:
   ```powershell
   npm run seed:products
   ```
   You can run the seed command before starting the server too. It hides the old demo catalog and activates the curated clothing, footwear, bags, eyewear and accessories collection.

## Create the first administrator
With `.env` configured, run:
```powershell
npm run seed:admin
```
The script reads the admin name/email/password from `.env`; there are no hard-coded admin credentials. Then sign in using `admin-login.html`.

## API and authentication
- `POST /api/auth/phone/send-otp` / `verify-otp` — **primary**: mobile signup (`purpose:"register"`, name required, email optional) and login (`purpose:"login"`)
- `POST /api/auth/phone/link/send-otp` / `verify-otp` — signed-in legacy/Google account adds a verified mobile number
- `POST /api/auth/logout`, `POST /api/auth/logout-all` — clear this session / revoke every session
- `POST /api/auth/register` + `POST /api/auth/login` — legacy email + password accounts (still supported)
- `GET /api/auth/me` — current authenticated user
- `PUT /api/auth/profile` — update profile
- `POST /api/auth/wishlist/:productId` — toggle a saved product
- `GET/POST /api/cart`, `/api/cart/items` — protected account cart
- `POST /api/orders` — protected COD order; server calculates prices
- `GET /api/orders/my-orders` — current user's orders
- `/api/products` — public catalog; admin product mutations require an admin JWT
- `GET /api/health` — API and database status

## Local image and API fixes
- The frontend API defaults to `http://localhost:5000/api`, including when opened from Live Server.
- The hero background and broken product-image fallback are local SVG assets, so the page still has visible imagery when external image hosts are unavailable. Real product photos still require working image URLs or local product files.

## Validation
Run `npm run check` in `backend` for JavaScript syntax checks. Then visit `http://localhost:5000/api/health`; it should return HTTP 200 with `database: "connected"`. A working MongoDB connection is required for end-to-end authentication, product CRUD and orders.

## Important limits
- Only Cash on Delivery is configured; no online payment gateway is connected.
- The admin panel lists users, recent orders and support tickets; order and ticket statuses can be updated through protected admin endpoints. The cart-count metric is not an aggregate analytics endpoint.
- The provided source did not include the original CSS or `js/products.js`, so this package supplies a responsive stylesheet and a 12-item starter catalog. Replace the starter products/images with your real catalog as needed.
- Before production, review deployment, HTTPS, rate limits, audit logging, backups, stock reservation/transactions, and data privacy.

## Security notice
A previously uploaded `.env` file contained credentials. Rotate the MongoDB database user's password, replace `JWT_SECRET`, and change the administrator password before using this project. Do not copy the old secret values into this package.


## Account, reviews and support notes
- Forgot-password reset tokens are returned only in development mode for local testing. A production email provider is not configured in this project, so configure SMTP/email delivery before enabling password reset for production users.
- Product details show size selection, stock, description and persisted reviews. Product reviews require a signed-in customer and allow one review per account per product. Clothing items with sizes redirect users to product detail before adding to cart.
- Support requests are saved to MongoDB and can be listed/updated by an admin through `/api/support/admin/all` and `/api/support/admin/:id`. Guest support requests are saved without a user association.
- The AI chatbot widget has been removed.
- Only Cash on Delivery is implemented; do not advertise online payment until a payment gateway is configured.


## Recent UI updates
See `CHANGELOG-HI.md` for the previous fixes and the latest Home/Account UI changes in Hindi.


## Mobile-first accounts (OTP) — how it works
- **Mobile number = login ID.** Numbers are normalised to E.164 (`+919876543210`) and validated per country (`utils/phone.js`; India, US/CA, UK, UAE, Saudi, Qatar, Singapore, Malaysia, Australia, Nepal, Bangladesh, Sri Lanka — add a row to extend, or swap in `libphonenumber-js`).
- **Verified numbers are unique** (partial unique index). A number is marked verified only after the SMS OTP succeeds; unverified numbers typed into a profile never block or take over anyone's login.
- **Email is optional.** Email-less accounts are supported by a partial unique index on `email`.
- **Sessions**: an `HttpOnly` cookie (`vastra_session`) — no token is stored in localStorage or returned in JSON. Unsafe requests (POST/PUT/PATCH/DELETE) must carry `X-CSRF-Token` (returned by login and `GET /auth/me`) and, if present, an allow-listed `Origin`. Password reset and "log out everywhere" revoke all sessions. Users logged in with an older build are signed out once and must log in again.
- **Existing accounts** keep working with email + password. They are never merged or deleted; they can add a verified mobile number from *Profile → Verify your mobile number*.
- **Unknown number at login** returns “No account found – create one” (clear UX; this does reveal whether a number is registered — OTP endpoints are rate-limited per IP and per number to limit enumeration).

### Upgrade an existing database
```powershell
cd backend
npm install
npm run migrate:auth            # dry run: reports what would change, aborts if verified phones collide
npm run migrate:auth -- --apply # clears old placeholder emails (…@phone.vastra.invalid) and builds the new indexes
```
The server also upgrades the `users` indexes at startup (replacing only the legacy `email_1`). Back up first.

### Turning on SMS (required for real signups)
1. Create a Twilio **Verify** service; put `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` in `backend/.env`.
2. For India, SMS delivery needs DLT registration with your telecom provider; Twilio trial accounts can only text verified numbers.
3. Without these, the OTP endpoints answer `503 OTP_NOT_CONFIGURED` — nothing pretends to work.

### Tests
```powershell
npm test                    # unit tests (phone, cookies/CSRF, OTP limits, controllers, session middleware) — no database needed
$env:MONGO_URI_TEST="mongodb://127.0.0.1:27017/vastra_test"; npm run test:integration   # full flow on a real MongoDB (drops the `users` collection in that DB)
```
