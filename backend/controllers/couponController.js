const Coupon = require('../models/Coupon');
const Order = require('../models/Order');

async function ensureBuiltIns(){
 for(const c of [{code:'VASTRA20',discountPercent:20,eligibility:'first_order'},{code:'OLD10',discountPercent:10,eligibility:'account_age_365'}]) await Coupon.updateOne({code:c.code},{$setOnInsert:{...c,active:true}},{upsert:true});
}
async function validateCoupon(user, code, subtotal) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return { coupon:null, discount:0 };
  if (['VASTRA20','OLD10'].includes(clean)) await ensureBuiltIns();
  const coupon = await Coupon.findOne({code:clean, active:true});
  if (!coupon || coupon.active === false || (coupon.startsAt && coupon.startsAt > new Date()) || (coupon.expiresAt && coupon.expiresAt < new Date()) || (coupon.maxUses && coupon.uses >= coupon.maxUses)) throw Object.assign(new Error('Coupon is invalid, inactive, expired, or fully used.'),{status:400});
  if (coupon.eligibility === 'first_order') {
    const prior = await Order.exists({user:user._id});
    if (prior) throw Object.assign(new Error('VASTRA20 is only for your first order.'),{status:400});
  }
  if (coupon.eligibility === 'account_age_365') {
    const created = new Date(user.createdAt || Date.now()).getTime();
    if (Date.now()-created < 365*86400000) throw Object.assign(new Error('OLD10 requires an account at least 365 days old.'),{status:400});
  }
  const discount = Math.round((subtotal * coupon.discountPercent / 100) * 100) / 100;
  return {coupon, discount:Math.min(subtotal, Math.round(discount*100)/100)};
}
exports.validateCoupon = validateCoupon;
exports.listAdmin = async (_req,res)=>{await ensureBuiltIns();res.json({success:true,coupons:await Coupon.find().sort({createdAt:-1})});};
exports.create = async (req,res)=>{
 const code=String(req.body.code||'').trim().toUpperCase(); const discountPercent=Number(req.body.discountPercent); const eligibility=String(req.body.eligibility||'all');
 if(!/^[A-Z0-9_-]{3,40}$/.test(code)||!Number.isFinite(discountPercent)||discountPercent<1||discountPercent>100||!['first_order','account_age_365','all'].includes(eligibility)) return res.status(400).json({success:false,message:'Enter a valid code, 1–100% discount, and eligibility.'});
 try { const coupon=await Coupon.create({code,discountPercent,eligibility,active:req.body.active!==false,expiresAt:req.body.expiresAt||null,maxUses:req.body.maxUses||null}); res.status(201).json({success:true,coupon}); }
 catch(e){if(e.code===11000)return res.status(409).json({success:false,message:'Coupon code already exists.'});throw e;}
};
exports.update = async (req,res)=>{const coupon=await Coupon.findByIdAndUpdate(req.params.id,{$set:{active:!!req.body.active,discountPercent:req.body.discountPercent,eligibility:req.body.eligibility,expiresAt:req.body.expiresAt||null,maxUses:req.body.maxUses||null}},{new:true,runValidators:true});if(!coupon)return res.status(404).json({success:false,message:'Coupon not found.'});res.json({success:true,coupon});};
exports.remove = async (req,res)=>{const coupon=await Coupon.findByIdAndDelete(req.params.id);if(!coupon)return res.status(404).json({success:false,message:'Coupon not found.'});res.json({success:true});};
exports.check = async (req,res)=>{const subtotal=Number(req.body.subtotal);if(!Number.isFinite(subtotal)||subtotal<=0)return res.status(400).json({success:false,message:'Invalid subtotal.'});const result=await validateCoupon(req.user,req.body.code,subtotal);res.json({success:true,code:result.coupon?.code||'',discount:result.discount,discountPercent:result.coupon?.discountPercent||0});};
