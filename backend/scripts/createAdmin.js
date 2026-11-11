require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

async function main() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.");
  if (process.env.ADMIN_PASSWORD.length < 12 || /REPLACE_WITH|ChangeThisAdminPassword|example\.com/i.test(process.env.ADMIN_PASSWORD) || /your-admin-email|admin@example\.com/i.test(process.env.ADMIN_EMAIL)) throw new Error("Set a real, unique ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in backend/.env before creating an admin.");
  await connectDB();
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  const user = await User.findOneAndUpdate({ email }, {
    $set: { name: process.env.ADMIN_NAME || "VASTRA Admin", email, passwordHash, role: "admin" }
  }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  console.log("Admin ready:", user.email);
  await mongoose.disconnect();
}
main().catch(async e => { console.error(e.message); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
