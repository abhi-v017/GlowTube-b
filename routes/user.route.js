import {Router} from "express"
import { registerUser, loginUser, logoutUser, refreshAccessToken, getCurrentUser } from "../controllers/user.controller.js"
import { verifyJwt } from "../middleware/auth.middleware.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const router = Router()

router.route('/register').post(registerUser)
router.route('/login').post(loginUser)
router.route('/logout').post(verifyJwt, logoutUser)
router.route('/refresh-access-token').post(asyncHandler(refreshAccessToken))
router.route('/current').get(verifyJwt, getCurrentUser)

export default router
