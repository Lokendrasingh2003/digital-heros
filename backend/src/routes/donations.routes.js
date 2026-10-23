import { Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const donationSchema = z.object({
  charityId: z.string().uuid(),
  amount: z.number().min(1).max(100000),
});

// One-off donations are independent of scores and draw entries.
router.post("/", authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe is not configured on the server.",
      });
    }

    const validation = donationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          validation.error.issues[0]?.message ||
          "Enter a donation of at least 1.",
      });
    }

    const { charityId, amount } = validation.data;

    const { data: charity, error: charityError } = await supabase
      .from("charities")
      .select("id, name")
      .eq("id", charityId)
      .eq("is_active", true)
      .maybeSingle();

    if (charityError) throw charityError;

    if (!charity) {
      return res.status(400).json({
        success: false,
        message: "Please choose an active charity.",
      });
    }

    const { data: donation, error: insertError } = await supabase
      .from("donations")
      .insert({
        user_id: req.user.id,
        charity_id: charityId,
        amount,
        currency: "USD",
        payment_status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Donation to ${charity.name}`,
              description: "Independent donation. Not tied to the monthly draw.",
            },
          },
        },
      ],
      client_reference_id: req.user.id,
      metadata: {
        type: "donation",
        donationId: donation.id,
        userId: req.user.id,
        charityId,
      },
      success_url: `${frontendUrl}/dashboard?donation=success`,
      cancel_url: `${frontendUrl}/dashboard?donation=cancelled`,
    });

    await supabase
      .from("donations")
      .update({ provider_payment_id: session.id })
      .eq("id", donation.id);

    return res.status(201).json({
      success: true,
      message: "Donation checkout created.",
      checkoutUrl: session.url,
    });
  } catch (error) {
    console.error("Create donation error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to start the donation.",
    });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("donations")
      .select(
        "id, amount, currency, payment_status, created_at, charities (name)"
      )
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({ success: true, donations: data ?? [] });
  } catch (error) {
    console.error("Fetch donations error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load donations.",
    });
  }
});

export default router;
