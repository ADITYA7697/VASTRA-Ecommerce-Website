/**
 * Mobile-first auth migration. Safe by default: prints what WOULD change; pass --apply to write.
 *   npm run migrate:auth            (report only)
 *   npm run migrate:auth -- --apply
 *
 * 1. Replaces the legacy unique `email_1` index with a partial one (email optional) and creates the
 *    verified-phone unique index. Aborts, changing nothing, if existing data would violate it.
 * 2. Removes ONLY the placeholder emails (*@phone.vastra.invalid) that the old phone login invented.
 * 3. Never deletes, merges or re-parents users. Email accounts keep working with email + password and can
 *    add a verified mobile number later (Profile -> "Verify mobile number").
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { PLACEHOLDER_EMAIL } = require("../utils/publicUser");
const { ensureUserIndexes } = require("../config/indexes");

(async () => {
  const apply = process.argv.includes("--apply");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing from .env");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const users = User.collection;

  const dupPhones = await users.aggregate([{ $match: { phoneVerified: true, phone: { $type: "string", $ne: "" } } }, { $group: { _id: "$phone", ids: { $push: "$_id" }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]).toArray();
  if (dupPhones.length) {
    console.error(`ABORT: ${dupPhones.length} verified phone number(s) are shared by several accounts. Resolve manually (nothing was changed):`);
    for (const d of dupPhones) console.error(`  ${d._id.slice(0, 3)}…${d._id.slice(-4)} -> accounts ${d.ids.join(", ")}`);
    process.exitCode = 2; return;
  }
  const placeholders = await users.countDocuments({ email: { $regex: PLACEHOLDER_EMAIL } });
  const withoutEmail = await users.countDocuments({ email: { $exists: false } });
  const total = await users.countDocuments();
  console.log(`Users: ${total} | placeholder emails to clear: ${placeholders} | already email-less: ${withoutEmail}`);
  if (!apply) { console.log("Dry run only. Re-run with --apply to migrate."); return; }
  if (placeholders) {
    const r = await users.updateMany({ email: { $regex: PLACEHOLDER_EMAIL } }, { $unset: { email: "" } });
    console.log(`Cleared ${r.modifiedCount} placeholder email(s).`);
  }
  await ensureUserIndexes();
  console.log("Indexes ready. Migration complete.");
})().catch(e => { console.error("Migration failed:", e.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
