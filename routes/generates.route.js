import express from "express"
import { creategenerate, getAllGenerates, getGenerateById, testCreditDeduction } from "../controllers/generates.controller.js"
import { verifyJwt } from "../middleware/auth.middleware.js"

const router = express.Router()

router.use(verifyJwt)

router.post('/', creategenerate)
router.get('/', getAllGenerates)
router.post('/:id', getGenerateById)
router.post('/test-credit', testCreditDeduction)

export default router