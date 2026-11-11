# VASTRA — Final local setup (Hindi)

## 1) Apni `.env` file
`backend/.env.example` ko copy karke `backend/.env` naam dein (agar `.env` pehle se hai to use overwrite na karein). Apne existing MongoDB URI aur JWT_SECRET ko private rakhein. `JWT_SECRET` kam-se-kam 32 characters ka unique random secret hona chahiye. `MONGO_URI` mein apne Atlas ka sahi connection string ho.

## 2) Backend install aur run
VS Code terminal kholen aur project ke `backend` folder mein:

```powershell
npm install
npm run dev
```

Terminal mein `VASTRA API running: http://localhost:5000` aana chahiye. Database check: browser mein `http://localhost:5000/api/health` kholen; `success: true` aur `database: connected` expected hai.

## 3) Website kholen
**Website ko `http://localhost:5000/` se kholen**, file par double-click karke `file://` se nahi. Is project ka Express server `frontend` folder ko serve karta hai, isliye CSS/JS ke relative paths sahi origin se load honge.

## Agar issue aaye
- `database: disconnected`: `.env` ka `MONGO_URI`, Atlas IP access list, DB username/password aur network check karein.
- `JWT_SECRET` error: `.env` mein unique random secret (32+ characters) set karein.
- CSS missing: address bar `http://localhost:5000/account.html` jaisa hona chahiye, `file:///...` ya alag purane project ka port nahi.

## Security
`.env` ko ZIP/GitHub/chat mein share na karein. Agar database credentials ya JWT secret screenshot mein public hue hon, unhe rotate karein. Online payment gateway credentials configure kiye bina live online payments enabled nahi hote.


## Product prices update करना
अगर products पहले से MongoDB Atlas में सेव हैं, तो `backend` folder में यह कमांड चलाएँ:
```bash
npm run update:prices
```
यह नाम/category के हिसाब से पहचाने गए fashion products के दाम अपडेट करता है और कोई product delete या deactivate नहीं करता। पहले database backup रखना बेहतर है। इसके बाद वेबसाइट refresh करें।


## Admin account banana (first time)
1. `backend/.env` mein `ADMIN_EMAIL`, `ADMIN_NAME`, aur ek apna unique `ADMIN_PASSWORD` (kam-se-kam 12 characters) set karein. Example placeholder ko as-is use na karein.
2. `backend` folder mein `npm run seed:admin` chalayein. Yeh configured MongoDB mein admin account banayega/update karega.
3. Website par `http://localhost:5000/admin-login.html` kholen aur wahi email/password use karein. Is chat se aapke MongoDB account mein seedha admin create nahi kiya ja sakta, isliye koi made-up login details nahi di ja rahi hain.

## Coupon rules
- `VASTRA20`: first order only, 20% off.
- `OLD10`: account must be at least 365 days old, 10% off.
- Coupon eligibility and discount are recalculated on the server. Admin can activate/deactivate managed coupons and create more.
