import { Router } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { listScores, removeScore, saveScore } from "../services/scores.js";

const router = Router();
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

router.use(authenticateToken, requireAdmin);

const scoreSchema = z
  .object({
    scoreDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    stablefordScore: z.number().int().min(1).max(45),
  })
  .refine(({ scoreDate }) => {
    const date = new Date(`${scoreDate}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === scoreDate
    );
  });

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  role: z.enum(["user", "admin"]).optional(),
  selectedCharityId: z.string().uuid().nullable().optional(),
  charityContributionPercent: z.number().min(10).max(100).optional(),
});

router.get("/", async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select(
        "id, full_name, email, role, selected_charity_id, charity_contribution_percent, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const { data: subscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select(
        "user_id, plan, status, amount, currency, current_period_end, cancel_at_period_end, updated_at"
      )
      .order("updated_at", { ascending: false });

    if (subError) throw subError;

    const latestByUser = new Map();

    for (const subscription of subscriptions ?? []) {
      if (!latestByUser.has(subscription.user_id)) {
        latestByUser.set(subscription.user_id, subscription);
      }
    }

    return res.json({
      success: true,
      users: (users ?? []).map((user) => ({
        ...user,
        subscription: latestByUser.get(user.id) || null,
      })),
    });
  } catch (error) {
    console.error("Admin user list error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load users.",
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const validation = profileSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          validation.error.issues[0]?.message || "Invalid profile update.",
      });
    }

    const updates = { updated_at: new Date().toISOString() };
    const body = validation.data;

    if (body.fullName !== undefined) updates.full_name = body.fullName;
    if (body.role !== undefined) updates.role = body.role;
    if (body.selectedCharityId !== undefined) {
      updates.selected_charity_id = body.selectedCharityId;
    }
    if (body.charityContributionPercent !== undefined) {
      updates.charity_contribution_percent = body.charityContributionPercent;
    }

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", req.params.id)
      .select(
        "id, full_name, email, role, selected_charity_id, charity_contribution_percent"
      )
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      message: "User updated.",
      user: data,
    });
  } catch (error) {
    console.error("Admin update user error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update user.",
    });
  }
});

router.get("/:id/scores", async (req, res) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const scores = await listScores(req.params.id);
    return res.json({ success: true, scores });
  } catch (error) {
    console.error("Admin fetch scores error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load scores.",
    });
  }
});

router.post("/:id/scores", async (req, res) => {
  try {
    const validation = scoreSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0]?.message || "Invalid score.",
      });
    }

    const result = await saveScore(
      req.params.id,
      validation.data.scoreDate,
      validation.data.stablefordScore
    );

    return res.json({
      success: true,
      message: "Score saved.",
      scores: result.scores,
    });
  } catch (error) {
    console.error("Admin save score error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to save score.",
    });
  }
});

router.delete("/:id/scores/:scoreId", async (req, res) => {
  try {
    const result = await removeScore(req.params.id, req.params.scoreId);

    if (result.notFound) {
      return res.status(404).json({
        success: false,
        message: "Score not found.",
      });
    }

    return res.json({
      success: true,
      message: "Score deleted.",
      scores: result.scores,
    });
  } catch (error) {
    console.error("Admin delete score error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to delete score.",
    });
  }
});

router.post("/:id/cancel-subscription", async (req, res) => {
  try {
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("id, provider_subscription_id, status")
      .eq("user_id", req.params.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "This user has no subscription.",
      });
    }

    if (
      stripe &&
      subscription.provider_subscription_id &&
      subscription.status === "active"
    ) {
      await stripe.subscriptions.update(subscription.provider_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (updateError) throw updateError;

    return res.json({
      success: true,
      message: "Subscription will end at the close of the current period.",
    });
  } catch (error) {
    console.error("Admin cancel subscription error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to cancel subscription.",
    });
  }
});

export default router;
