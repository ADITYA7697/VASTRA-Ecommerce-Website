require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const path = require("path");
const connectDB = require("./config/db");

const app = express();
app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Helmet's default CSP blocked product images from admin-entered URLs, the Razorpay checkout script/iframe
  // and the inline onclick/onerror handlers used by the pages. Only what the storefront needs is opened up.
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", "https://checkout.razorpay.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
      frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"]
    }
  }
}));

if (process.env.TRUST_PROXY) app.set("trust proxy", /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY); // set behind a reverse proxy so rate limits see real client IPs
const origins = require("./config/origins").list();
app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS blocked this origin. Set FRONTEND_ORIGIN in .env."));
  },
  credentials: true,                                   // required for the HttpOnly session cookie
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
// Explicit asset mount prevents image URLs from depending on static-root resolution.
const frontendRoot = path.resolve(__dirname, "../frontend");
app.use("/assets", express.static(path.join(frontendRoot, "assets"), { fallthrough: false, immutable: true, maxAge: "1d" }));
// Serve the storefront from the same origin to simplify local setup and avoid CORS issues.
app.use(express.static(frontendRoot, { extensions: ["html"] }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false });
app.use(["/api/auth/login", "/api/auth/login-phone"], rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, skip: () => process.env.NODE_ENV === "test", message: { success: false, code: "RATE_LIMITED", message: "Too many login attempts. Please try again later." } }));
app.use("/api/auth/register", limiter);
app.use("/api/auth/signup", limiter);
app.use("/api/auth/google", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));
// OTP endpoints: per-IP limits here, per-number cooldown/caps/lockout in services/otp.js. Disabled under NODE_ENV=test.
const otpLimiter = (limit, message) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: "draft-7", legacyHeaders: false, skip: () => process.env.NODE_ENV === "test", message: { success: false, code: "RATE_LIMITED", message } });
app.use(["/api/auth/phone/send-otp", "/api/auth/phone/link/send-otp"], otpLimiter(10, "Too many OTP requests. Please try again in a few minutes."));
app.use(["/api/auth/phone/verify-otp", "/api/auth/phone/link/verify-otp"], otpLimiter(20, "Too many verification attempts. Please try again in a few minutes."));
app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); }); // API responses carry personal data

app.get("/", (_req, res) => res.sendFile(path.resolve(__dirname, "../frontend/index.html")));
app.get("/api/health", (_req, res) => {
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({ success: ok, server: "ok", database: ok ? "connected" : "disconnected" });
});
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/coupons", require("./routes/couponRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/support", require("./routes/supportRoutes"));
app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found." }));
app.use((err, _req, res, _next) => {
  if (err.message && err.message.startsWith("CORS blocked")) return res.status(403).json({ success: false, message: err.message });
  if (err.code === 11000) return res.status(409).json({ success: false, message: "Duplicate value." });
  if (err.name === "ValidationError" || err.name === "CastError") return res.status(400).json({ success: false, message: err.message });
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 600) return res.status(err.status).json({ success: false, message: err.message });
  console.error(err);
  res.status(500).json({ success: false, message: process.env.NODE_ENV === "production" ? "Internal server error." : err.message });
});

const PORT = Number(process.env.PORT) || 5000;
const jwtSecretOk = () => process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 && !process.env.JWT_SECRET.toLowerCase().includes("replace_with");
module.exports = app; // imported by tests; the server only starts when run directly (npm start)
if (require.main === module) {
  if (!jwtSecretOk()) {
    console.error("Backend startup failed: set a unique JWT_SECRET of at least 32 characters in .env.");
    process.exit(1);
  }
  try { require("./utils/cookies").cookieOptions(); } catch (e) { console.error("Backend startup failed:", e.message); process.exit(1); }
  connectDB().then(() => require("./seedProducts").syncProducts().then(n => console.log(`Catalog synced: ${n} products, all under ₹1000.`)).catch(e => console.warn("Catalog sync skipped:", e.message))).then(() => app.listen(PORT, () => console.log(`VASTRA API running: http://localhost:${PORT}`)))
    .catch(err => { console.error("Backend startup failed:", err.message); process.exit(1); });
}
