const mongoose = require('mongoose');
const schema = new mongoose.Schema({
 code: {type:String, required:true, unique:true, uppercase:true, trim:true, minlength:3, maxlength:40},
 discountPercent:{type:Number, required:true, min:1, max:100},
 eligibility:{type:String, enum:['first_order','account_age_365','all'], default:'all'},
 active:{type:Boolean, default:true},
 startsAt:{type:Date, default:null}, expiresAt:{type:Date, default:null},
 maxUses:{type:Number, min:1, default:null}, uses:{type:Number, min:0, default:0}
}, {timestamps:true});
module.exports = mongoose.model('Coupon', schema);
