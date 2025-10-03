import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt"

// user schema
const userSchema = new Schema(
    {
        email:{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        planType: {
            type: String,
            enum: ["free", "pro", "agency"],
            default: "free"
        },
        creditsLeft: {
            type: Number,
            default: 10
        },
        password:{
            type: String,
            required: [true, "password is required"],
        },
        refreshToken:{
            type: String
        },
        razorpay_subscription_id: {
            type: String,
            unique: true,
            sparse: true
        },
        razorpay_customer_id: {
            type: String,
            unique: true,
            sparse: true
        }
    },
    {
        timestamps: true
    }
)

// hash password before saving
userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10)
    next();
})

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

// generate access token
userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

// generate refresh token
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

// export user model
export const  User = mongoose.model("User", userSchema)