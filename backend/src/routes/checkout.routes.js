
import { Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;

const checkoutSchema = z.object({
  plan: z.enum(["monthly", "yearly"]),
});

router.post("/create-session", authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe is not configured on the server.",
      });
    }

    const validation = checkoutSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Plan must be monthly or yearly.",
      });
    }

    const { plan } = validation.data;

    const priceId =
      plan === "monthly"
        ? process.env.STRIPE_MONTHLY_PRICE_ID
        : process.env.STRIPE_YEARLY_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({
        success: false,
        message: `Stripe price is not configured for the ${plan} plan.`,
      });
    }

    const frontendUrl =
      process.env.FRONTEND_URL || "http://localhost:5173";

    const { data: account, error: accountError } = await supabase
      .from("users")
      .select("email")
      .eq("id", req.user.id)
      .maybeSingle();

    if (accountError) throw accountError;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: req.user.id,
      customer_email: account?.email,
      metadata: {
        userId: req.user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          userId: req.user.id,
          plan,
        },
      },
      success_url:
        `${frontendUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        `${frontendUrl}/dashboard?checkout=cancelled`,
    });

    return res.status(201).json({
      success: true,
      message: "Checkout session created.",
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Create checkout session error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create checkout session.",
    });
  }
});

export default router;
