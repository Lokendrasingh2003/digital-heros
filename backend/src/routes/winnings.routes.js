import { Router } from "express";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

const proofSchema = z.object({
  proofUrl: z.string().trim().url().max(2000),
});

router.use(authenticateToken);

// GET /api/winnings/me
router.get("/me", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("winners")
      .select(
        `
        id,
        match_tier,
        prize_amount,
        proof_url,
        verification_status,
        payout_status,
        reviewed_at,
        paid_at,
        created_at,
        draws (
          draw_month,
          drawn_numbers,
          status
        )
      `
      )
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const winnings = data ?? [];
    const totalWon = winnings
      .filter((item) => item.verification_status !== "rejected")
      .reduce((sum, item) => sum + Number(item.prize_amount || 0), 0);

    return res.json({
      success: true,
      winnings,
      totalWon: Number(totalWon.toFixed(2)),
    });
  } catch (error) {
    console.error("Fetch winnings error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load winnings.",
    });
  }
});

// POST /api/winnings/:id/proof — winners upload a score screenshot URL.
router.post("/:id/proof", async (req, res) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      return res.status(400).json({
        success: false,
        message: "Invalid winning ID.",
      });
    }

    const validation = proofSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid screenshot URL.",
      });
    }

    const { data: existing, error: lookupError } = await supabase
      .from("winners")
      .select("id, verification_status, payout_status")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Winning not found.",
      });
    }

    if (existing.payout_status === "paid") {
      return res.status(409).json({
        success: false,
        message: "This prize has already been paid.",
      });
    }

    if (existing.verification_status === "approved") {
      return res.status(409).json({
        success: false,
        message: "This submission has already been approved.",
      });
    }

    const { data, error } = await supabase
      .from("winners")
      .update({
        proof_url: validation.data.proofUrl,
        verification_status: "pending",
        reviewed_at: null,
      })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select(
        "id, match_tier, prize_amount, proof_url, verification_status, payout_status"
      )
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      message: "Proof submitted. An admin will review it.",
      winning: data,
    });
  } catch (error) {
    console.error("Upload proof error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to submit proof.",
    });
  }
});

export default router;
