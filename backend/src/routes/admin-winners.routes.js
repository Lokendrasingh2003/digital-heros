import { Router } from "express";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/", async (req, res) => {
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
        user_id,
        users ( full_name, email ),
        draws ( draw_month, drawn_numbers )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({ success: true, winners: data ?? [] });
  } catch (error) {
    console.error("Admin winners error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load winners.",
    });
  }
});

const reviewSchema = z
  .object({
    verificationStatus: z.enum(["approved", "rejected"]).optional(),
    payoutStatus: z.enum(["paid"]).optional(),
  })
  .refine((value) => value.verificationStatus || value.payoutStatus, {
    message: "Provide a verification or payout update.",
  });

router.patch("/:id", async (req, res) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      return res.status(400).json({
        success: false,
        message: "Invalid winner ID.",
      });
    }

    const validation = reviewSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0]?.message || "Invalid review.",
      });
    }

    const { data: existing, error: lookupError } = await supabase
      .from("winners")
      .select("id, verification_status, payout_status, proof_url")
      .eq("id", req.params.id)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Winner not found.",
      });
    }

    const updates = {};
    const { verificationStatus, payoutStatus } = validation.data;

    if (verificationStatus) {
      if (!existing.proof_url) {
        return res.status(409).json({
          success: false,
          message: "The winner has not uploaded proof yet.",
        });
      }

      updates.verification_status = verificationStatus;
      updates.reviewed_at = new Date().toISOString();
    }

    if (payoutStatus === "paid") {
      const nextVerification =
        verificationStatus || existing.verification_status;

      if (nextVerification !== "approved") {
        return res.status(409).json({
          success: false,
          message: "Approve the submission before marking it paid.",
        });
      }

      updates.payout_status = "paid";
      updates.paid_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("winners")
      .update(updates)
      .eq("id", req.params.id)
      .select(
        "id, match_tier, prize_amount, proof_url, verification_status, payout_status, reviewed_at, paid_at"
      )
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      message: "Winner record updated.",
      winner: data,
    });
  } catch (error) {
    console.error("Review winner error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update winner.",
    });
  }
});

export default router;
