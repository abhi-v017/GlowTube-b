import dotenv from "dotenv"
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import connectdb from "./config/db.js"
import userRoutes from "./routes/user.route.js"
import generatesRoutes from "./routes/generates.route.js"
import paymentRoutes from "./routes/payment.route.js"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

// Robust .env loading: try backend/.env, then fallback to Backend/.env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const primaryEnvPath = path.join(__dirname, ".env")
const fallbackEnvPath = path.resolve(__dirname, "..", "Backend", ".env")
if (fs.existsSync(primaryEnvPath)) {
    dotenv.config({ path: primaryEnvPath })
} else if (fs.existsSync(fallbackEnvPath)) {
    dotenv.config({ path: fallbackEnvPath })
    console.warn(`Loaded env from fallback path: ${fallbackEnvPath}`)
} else {
    dotenv.config()
}
connectdb()

const app = express()
app.use(cors())
// Razorpay webhook must receive raw body for signature verification
app.use('/api/v1/payments/razorpay/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())
app.use(cookieParser())


// Health check endpoint to keep service awake on Render free tier
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// routes
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/generates', generatesRoutes)
app.use('/api/v1/payments', paymentRoutes)

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log(`server is listening on port ${PORT}`))