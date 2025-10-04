import express from "express";
import { User } from "../models/user.model.js";
import { createSubscription } from "../controllers/payment.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";
import crypto from "crypto";

const router = express.Router();

router.post("/create-subscription", verifyJwt, createSubscription);

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
            
            const user = await User.findOne({ razorpay_subscription_id: subscription.id });
            if (user) {
                const mapping = planIdToAppPlan[subscription.plan_id] || { planType: "pro", creditsLeft: 100 };
                console.log('Updating user credits:', user._id, 'to:', mapping);
                
                user.planType = mapping.planType;
                user.creditsLeft = mapping.creditsLeft;
                await user.save({ maxTimeMS: 10000 });
                
                console.log('User credits updated successfully');
            } else {
                console.error('User not found for subscription:', subscription.id);
            }
        }

        if (eventType === "subscription.cancelled") {
            const subscription = eventPayload.payload.subscription.entity;
            console.log('Processing subscription cancellation:', subscription.id);
            
            const user = await User.findOne({ razorpay_subscription_id: subscription.id });
            if (user) {
                console.log('Cancelling subscription for user:', user._id);
                
                user.planType = "free";
                user.creditsLeft = 0;
                await user.save({ maxTimeMS: 10000 });
                
                console.log('User subscription cancelled successfully');
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
