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
7. Open `http://localhost:5000`. The backend serves the frontend and API from one origin.
8. In another terminal from `backend`, seed the sample products:
   ```powershell
   npm run seed:products
   ```
   You can run the seed command before starting the server too.

## Create the first administrator
With `.env` configured, run:
```powershell
npm run seed:admin
```
The script reads the admin name/email/password from `.env`; there are no hard-coded admin credentials. Then sign in using `admin-login.html`.

## API and authentication
- `POST /api/auth/register` — create customer account (password hashed with bcrypt)
- `POST /api/auth/login` — login and issue JWT
- `GET /api/auth/me` — current authenticated user
- `PUT /api/auth/profile` — update profile
- `POST /api/auth/wishlist/:productId` — toggle a saved product
- `GET/POST /api/cart`, `/api/cart/items` — protected account cart
- `POST /api/orders` — protected COD order; server calculates prices
- `GET /api/orders/my-orders` — current user's orders
- `/api/products` — public catalog; admin product mutations require an admin JWT
- `GET /api/health` — API and database status

## Validation
Run `npm run check` in `backend` for JavaScript syntax checks. Then visit `http://localhost:5000/api/health`; it should return HTTP 200 with `database: "connected"`. A working MongoDB connection is required for end-to-end authentication, product CRUD and orders.

## Important limits
- Only Cash on Delivery is configured; no online payment gateway is connected.
- Admin stats for customers/cart/order counts are shown as unavailable because the provided backend does not expose those aggregate endpoints.
- The provided source did not include the original CSS or `js/products.js`, so this package supplies a responsive stylesheet and a 12-item starter catalog. Replace the starter products/images with your real catalog as needed.
- Before production, review deployment, HTTPS, rate limits, audit logging, backups, stock reservation/transactions, and data privacy.

## Security notice
A previously uploaded `.env` file contained credentials. Rotate the MongoDB database user's password, replace `JWT_SECRET`, and change the administrator password before using this project. Do not copy the old secret values into this package.


## Google Login और Mobile OTP (Payment Gateway अभी शामिल नहीं)

- Google endpoint: `POST /api/auth/google` body `{ "credential": "Google ID token" }`। Backend `GOOGLE_CLIENT_ID` के audience के विरुद्ध token verify करता है।
- OTP भेजना: `POST /api/auth/phone/send-otp` body `{ "phone": "+919876543210" }`।
- OTP verify/login: `POST /api/auth/phone/verify-otp` body `{ "phone": "+919876543210", "code": "123456" }`।
- Twilio Verify service और Google OAuth Web Client ID को `.env` में configure करना जरूरी है। Credentials के बिना endpoints जानबूझकर `503` देते हैं; कोई fake OTP या bypass मौजूद नहीं है।
- Google Login मौजूदा password account को चुपचाप link नहीं करता; पहले existing method से sign-in करना होगा।
- Browser में Google Identity Services से ID credential प्राप्त करके `/api/auth/google` पर भेजें। OTP के लिए पहले send endpoint, फिर user द्वारा डाला गया code verify endpoint पर भेजें।
- Mobile-only accounts में email field के पुराने schema requirement को internal `@phone.vastra.invalid` address से पूरा किया जाता है; यह वास्तविक email नहीं है और email verification का प्रमाण नहीं है।
- Payment Gateway इस build में जानबूझकर नहीं जोड़ा गया है।


## Online payment (Razorpay) setup

1. Razorpay dashboard में पहले **Test Mode** enable करके API Key ID और Key Secret बनाएँ।
2. `backend/.env.example` से `backend/.env` बनाएँ (यदि पहले से `.env` है तो उसे overwrite न करें) और `RAZORPAY_KEY_ID` तथा `RAZORPAY_KEY_SECRET` भरें। Secret सिर्फ backend में रखें।
3. Razorpay dashboard में payment capture को automatic capture पर रखें, या captured payment status सुनिश्चित करें; backend केवल captured payment स्वीकार करता है।
4. Backend restart करें। Checkout में Pay Online option तभी enabled होगा जब backend payment configuration उपलब्ध हो।
5. Test cards/UPI केवल Razorpay Test Mode में इस्तेमाल करें। Live keys लगाने से पहले HTTPS, domain, refund/cancellation process, webhook monitoring और वास्तविक test orders पूरा करें।

Endpoints: `GET /api/payments/config`, `POST /api/payments/razorpay/order`, `POST /api/payments/razorpay/verify` (दूसरे और तीसरे endpoint पर Bearer JWT आवश्यक है)। Server signature HMAC verify करता है, Razorpay API से payment status/amount जाँचता है, server-side saved quote से order बनाता है और stock को atomically reserve करता है।

## Authentication/security notes

- JWT issuer/audience और HS256 algorithm verify होते हैं; `JWT_SECRET` unique, random और कम से कम 32 characters रखें।
- Google OAuth के लिए `GOOGLE_CLIENT_ID`; SMS OTP के लिए Twilio Verify के तीन credentials आवश्यक हैं। Credentials न होने पर ये flows सुरक्षित रूप से unavailable रहते हैं।
- Password reset email delivery provider अभी configured नहीं है। Production में email provider integrate किए बिना reset flow को customer-facing production workflow न मानें।
- Live deployment पर HTTPS, exact `FRONTEND_ORIGIN`, database backups, secret rotation, Razorpay webhook reconciliation, logs/alerts, privacy/terms/refund policy और production smoke tests आवश्यक हैं।
