import express from "express";
import { User } from "../models/user.model.js";
import { createSubscription } from "../controllers/payment.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import crypto from "crypto";

const router = express.Router();

router.post("/create-subscription", verifyJwt, createSubscription);

// Fast payment confirmation endpoint - users can call this immediately after payment
router.post("/confirm-payment", verifyJwt, asyncHandler(async (req, res) => {
    console.log('Payment confirmation request for user:', req.user._id);
    
    try {
        // Get the most recent user data from database
        const updatedUser = await User.findById(req.user._id);
        
        if (!updatedUser) {
            throw new ApiError(404, 'User not found');
        }
        
        console.log('User current plan:', updatedUser.planType, 'Credits:', updatedUser.creditsLeft);
        
        return res.status(200).json(new ApiResponse(200, {
            planType: updatedUser.planType,
            creditsLeft: updatedUser.creditsLeft,
            razorpay_subscription_id: updatedUser.razorpay_subscription_id
        }, "Payment status retrieved successfully"));
        
    } catch (error) {
        console.error('Payment confirmation error:', error);
        throw new ApiError(500, "Failed to confirm payment status: " + error.message);
    }
}));

router.post("/razorpay/webhook", async (req, res) => {
    console.log('Webhook received:', new Date().toISOString());
    
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const payload = req.body;

    if (!secret) {
        console.error('Webhook secret not configured');
        return res.status(500).json({ message: "Webhook secret not configured" });
    }

    try {
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(req.body)
            .digest("hex");

        if (expectedSignature !== signature) {
            console.error('Invalid webhook signature');
            return res.status(400).send("Invalid signature");
        }
    } catch (err) {
        console.error('Webhook signature verification error:', err);
        return res.status(400).send("Invalid signature");
    }

    let eventPayload;
    try {
        eventPayload = JSON.parse(payload.toString());
        console.log('Webhook event type:', eventPayload.event);
    } catch (e) {
        console.error('Invalid webhook payload:', e);
        return res.status(400).send("Invalid payload");
    }

    const eventType = eventPayload.event;

    const planIdToAppPlan = {
        [process.env.RZP_PLAN_ID_PRO]: { planType: "pro", creditsLeft: 100 },
        [process.env.RZP_PLAN_ID_AGENCY]: { planType: "agency", creditsLeft: 500 }
    };

    try {
        if (eventType === "subscription.activated" || eventType === "subscription.charged") {
            const subscription = eventPayload.payload.subscription.entity;
            console.log('Processing subscription:', subscription.id);
            
            const mapping = planIdToAppPlan[subscription.plan_id] || { planType: "pro", creditsLeft: 100 };
            console.log('Updating user credits to:', mapping);
            
            // Use atomic update instead of find + save for better performance
            const updatedUser = await User.findOneAndUpdate(
                { razorpay_subscription_id: subscription.id },
                { 
                    planType: mapping.planType,
                    creditsLeft: mapping.creditsLeft
                },
                { 
                    new: true,
                    maxTimeMS: 5000 // Faster timeout for webhook
                }
            );
            
            if (updatedUser) {
                console.log('User credits updated successfully for:', updatedUser._id, 'New credits:', updatedUser.creditsLeft);
            } else {
                console.error('User not found for subscription:', subscription.id);
            }
        }

        if (eventType === "subscription.cancelled") {
            const subscription = eventPayload.payload.subscription.entity;
            console.log('Processing subscription cancellation:', subscription.id);
            
            // Use atomic update for cancellation too
            const updatedUser = await User.findOneAndUpdate(
                { razorpay_subscription_id: subscription.id },
                { 
                    planType: "free",
                    creditsLeft: 0
                },
                { 
                    new: true,
                    maxTimeMS: 5000 // Faster timeout for webhook
                }
            );
            
            if (updatedUser) {
                console.log('User subscription cancelled successfully for:', updatedUser._id);
            } else {
                console.error('User not found for subscription cancellation:', subscription.id);
            }
        }

        console.log('Webhook processed successfully');
        return res.json({ ok: true });
        
    } catch (error) {
        console.error('Webhook processing error:', error);
        return res.status(500).json({ error: 'Webhook processing failed', message: error.message });
    }
});

export default router;
