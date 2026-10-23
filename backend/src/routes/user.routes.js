
import { Router } from "express";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select(
        "id, full_name, email, role, selected_charity_id, charity_contribution_percent, created_at"
      )
      .eq("id", req.user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile lookup failed:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to load your profile.",
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Profile request failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load your profile.",
    });
  }
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
});

router.patch("/me", authenticateToken, async (req, res) => {
  try {
    const validation = profileSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Enter a name between 2 and 100 characters.",
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .update({
        full_name: validation.data.fullName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.user.id)
      .select(
        "id, full_name, email, role, selected_charity_id, charity_contribution_percent, created_at"
      )
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    return res.json({
      success: true,
      message: "Profile updated.",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update your profile.",
    });
  }
});

export default router;
