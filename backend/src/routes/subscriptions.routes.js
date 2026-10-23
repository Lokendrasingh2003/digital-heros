
import { Router } from "express";
import Stripe from "stripe";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

async function readPrice(priceId) {
  if (!stripe || !priceId) return null;

  const price = await stripe.prices.retrieve(priceId);
  return {
    amount: (price.unit_amount ?? 0) / 100,
    currency: (price.currency || "usd").toUpperCase(),
    interval: price.recurring?.interval || null,
  };
}

// GET /api/subscriptions/plans — public plan catalogue.
router.get("/plans", async (req, res) => {
  try {
    const [monthly, yearly] = await Promise.all([
      readPrice(process.env.STRIPE_MONTHLY_PRICE_ID),
      readPrice(process.env.STRIPE_YEARLY_PRICE_ID),
    ]);

    return res.json({
      success: true,
      plans: [
        {
          id: "monthly",
          name: "Monthly",
          description: "Billed every month. Cancel any time before renewal.",
          ...monthly,
        },
        {
          id: "yearly",
          name: "Yearly",
          description: "A discounted rate, billed once a year.",
          ...yearly,
        },
      ],
    });
  } catch (error) {
    console.error("Fetch plans error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load membership plans.",
    });
  }
});

// GET /api/subscriptions/me
// Get the logged-in user's latest subscription.
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select(
        "id, plan, status, amount, currency, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at"
      )
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Fetch subscription error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to fetch subscription details.",
      });
    }

    return res.status(200).json({
      success: true,
      subscription: subscription || null,
      message: subscription
        ? "Subscription retrieved successfully."
        : "No subscription found for this account.",
    });
  } catch (error) {
    console.error("Unexpected subscription error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred.",
    });
  }
});

// POST /api/subscriptions/cancel — stop renewal at the period end.
router.post("/cancel", authenticateToken, async (req, res) => {
  try {
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("id, provider_subscription_id, status, cancel_at_period_end")
      .eq("user_id", req.user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!subscription || subscription.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "No active subscription to cancel.",
      });
    }

    if (subscription.cancel_at_period_end) {
      return res.json({
        success: true,
        message: "This subscription is already set to end.",
      });
    }

    if (stripe && subscription.provider_subscription_id) {
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
      message: "Your membership will end on the next billing date.",
    });
  } catch (error) {
    console.error("Cancel subscription error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to cancel the subscription.",
    });
  }
});

export default router;
