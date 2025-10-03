import express from "express";
import { User } from "../models/user.model.js";
import { createSubscription } from "../controllers/payment.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";
import crypto from "crypto";

const router = express.Router();

router.post("/create-subscription", verifyJwt, createSubscription);

router.post("/razorpay/webhook", async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const payload = req.body;

    if (!secret) {
        return res.status(500).json({ message: "Webhook secret not configured" });
    }

    try {
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(req.body)
            .digest("hex");

        if (expectedSignature !== signature) {
            return res.status(400).send("Invalid signature");
        }
    } catch (err) {
        return res.status(400).send("Invalid signature");
    }

    let eventPayload;
    try {
        eventPayload = JSON.parse(payload.toString());
    } catch (e) {
        return res.status(400).send("Invalid payload");
    }

    const eventType = eventPayload.event;

    const planIdToAppPlan = {
        [process.env.RZP_PLAN_ID_PRO]: { planType: "pro", creditsLeft: 100 },
        [process.env.RZP_PLAN_ID_AGENCY]: { planType: "agency", creditsLeft: 500 }
    };

    if (eventType === "subscription.activated" || eventType === "subscription.charged") {
        const subscription = eventPayload.payload.subscription.entity;
        const user = await User.findOne({ razorpay_subscription_id: subscription.id });
        if (user) {
            const mapping = planIdToAppPlan[subscription.plan_id] || { planType: "pro", creditsLeft: 100 };
            user.planType = mapping.planType;
            user.creditsLeft = mapping.creditsLeft;
            await user.save();
        }
    }

    if (eventType === "subscription.cancelled") {
        const subscription = eventPayload.payload.subscription.entity;
        const user = await User.findOne({ razorpay_subscription_id: subscription.id });
        if (user) {
            user.planType = "free";
            user.creditsLeft = 0;
            await user.save();
        }
    }

    return res.json({ ok: true });
});

export default router;
