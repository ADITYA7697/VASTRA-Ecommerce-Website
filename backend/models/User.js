const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  // Email is OPTIONAL (mobile-first accounts). Uniqueness is enforced by a partial index (see config/indexes.js),
  // so many accounts can have no email while real addresses stay unique.
  email: { type: String, lowercase: true, trim: true, maxlength: 254, default: undefined },
  passwordHash: { type: String, required: false, select: false },
  googleSub: { type: String, unique: true, sparse: true, select: false },
  authProvider: { type: String, enum: ["local", "google", "phone", "google_phone"], default: "local" },
  emailVerified: { type: Boolean, default: false },
  // `phone` holds E.164 for verified numbers. Only VERIFIED numbers are unique (partial index) so an
  // unverified number typed into a profile can never block or hijack another customer's login.
  phone: { type: String, trim: true, default: "" },
  phoneVerified: { type: Boolean, default: false },
  phoneVerifiedAt: { type: Date },
  // Bumped on password reset / "log out everywhere"; sessions carrying an older value are rejected.
  tokenVersion: { type: Number, default: 0, select: true },
  passwordResetHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ["", "Male", "Female", "Other"], default: "" },
  address: {
    line1: { type: String, default: "" }, line2: { type: String, default: "" },
    city: { type: String, default: "" }, state: { type: String, default: "" },
    postalCode: { type: String, default: "" }, country: { type: String, default: "India" }
  },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }]
}, { timestamps: true });

// Declared here so a fresh database gets them automatically; existing databases are upgraded by
// config/indexes.js (the old non-partial unique `email_1` index must be replaced first).
schema.index({ email: 1 }, { unique: true, name: "email_unique_when_present", partialFilterExpression: { email: { $type: "string" } } });
schema.index({ phone: 1 }, { unique: true, name: "verified_phone_unique", partialFilterExpression: { phoneVerified: true, phone: { $type: "string" } } });

module.exports = mongoose.model("User", schema);
