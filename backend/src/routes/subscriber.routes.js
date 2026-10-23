
import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/requireSubscription.js";

const router = Router();

router.get(
  "/test",
  authenticateToken,
  requireActiveSubscription,
  (req, res) => {
    res.json({
      success: true,
      message: "You have access to subscriber-only features.",
      subscription: req.subscription,
    });
  }
);

export default router;
