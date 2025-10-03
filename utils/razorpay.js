import Razorpay from "razorpay";
import crypto from "crypto";

// Lazily initialize Razorpay client after envs are loaded
let cachedClient = null;

function getRazorpayClient() {
    const hasKeys = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
    if (!hasKeys) {
        return null;
    }
    if (cachedClient) {
        return cachedClient;
    }
    cachedClient = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    return cachedClient;
}

const razorpay = {
    subscriptions: {
        async create(params) {
            const client = getRazorpayClient();
            if (!client) {
                throw new Error("Razorpay disabled: missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET");
            }
            return client.subscriptions.create(params);
        }
    },
    validateWebhookSignature: (payload, signature, secret) => {
        const digest = crypto
            .createHmac("sha256", secret)
            .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
            .digest("hex");
        if (digest !== signature) {
            throw new Error("Invalid signature");
        }
        return true;
    }
};

export default razorpay;