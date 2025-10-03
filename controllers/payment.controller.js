import {User} from '../models/user.model.js'
import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import razorpay from '../utils/razorpay.js'

export const createSubscription = asyncHandler(async (req, res) => {
    // req.user already exists (auth middleware)
    const { planKey } = req.body;  // simple key like "pro" or "agency"
    if (!planKey) {
        throw new ApiError(400, "planKey is required");
    }

    // Map planKey -> Razorpay plan_id from backend env
    const planMap = {
        pro: process.env.RZP_PLAN_ID_PRO,
        agency: process.env.RZP_PLAN_ID_AGENCY
    };
    const plan_id = planMap[planKey];
    if (!plan_id) {
        throw new ApiError(400, `Unknown planKey or missing env mapping: ${planKey}`);
    }

    try {
        const subscription = await razorpay.subscriptions.create({
            plan_id,
            customer_notify: 1,
            total_count: 12,
            quantity: 1,
        });

        await User.findByIdAndUpdate(req.user._id, {
            razorpay_subscription_id: subscription.id
        });

        return res.status(200).json(new ApiResponse(200, {
            subscriptionId: subscription.id,
            subscription
        }, "Subscription created successfully"));
    } catch (error) {
        throw new ApiError(500, "Failed to create subscription: " + error.message);
    }
})