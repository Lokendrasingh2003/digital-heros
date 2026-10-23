
import { Router } from "express";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// GET /api/charities
// Public: list active charities.
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("charities")
      .select(
        "id, name, description, image_url, website_url, category, is_featured"
      )
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("Fetch charities error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to fetch charities.",
      });
    }

    return res.status(200).json({
      success: true,
      count: data.length,
      charities: data,
    });
  } catch (error) {
    console.error("Unexpected fetch charities error:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred.",
    });
  }
});

// GET /api/charities/:id — public profile, including upcoming events.
router.get("/:id", async (req, res) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      return res.status(400).json({
        success: false,
        message: "Invalid charity ID.",
      });
    }

    const { data: charity, error } = await supabase
      .from("charities")
      .select(
        "id, name, description, image_url, website_url, category, is_featured"
      )
      .eq("id", req.params.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;

    if (!charity) {
      return res.status(404).json({
        success: false,
        message: "Charity not found.",
      });
    }

    const { data: events, error: eventsError } = await supabase
      .from("charity_events")
      .select("id, title, description, event_date, image_url")
      .eq("charity_id", charity.id)
      .order("event_date", { ascending: true });

    if (eventsError) throw eventsError;

    return res.json({
      success: true,
      charity,
      events: events ?? [],
    });
  } catch (error) {
    console.error("Fetch charity error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load this charity.",
    });
  }
});

const selectionSchema = z.object({
  charityId: z.string().uuid(),
  contributionPercent: z.number().min(10).max(100).optional(),
});

// PATCH /api/charities/selection
// Protected: update the logged-in user's charity and contribution.
router.patch("/selection", authenticateToken, async (req, res) => {
  try {
    const validation = selectionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          validation.error.issues[0]?.message ||
          "Invalid charity selection.",
      });
    }

    const { charityId, contributionPercent } = validation.data;

    const { data: charity, error: charityError } = await supabase
      .from("charities")
      .select("id, name")
      .eq("id", charityId)
      .eq("is_active", true)
      .maybeSingle();

    if (charityError) {
      console.error("Validate charity error:", charityError);
      return res.status(500).json({
        success: false,
        message: "Unable to validate the selected charity.",
      });
    }

    if (!charity) {
      return res.status(400).json({
        success: false,
        message: "The selected charity does not exist or is inactive.",
      });
    }

    const updates = {
      selected_charity_id: charityId,
      updated_at: new Date().toISOString(),
    };

    if (contributionPercent !== undefined) {
      updates.charity_contribution_percent = contributionPercent;
    }

    const { data: user, error: updateError } = await supabase
      .from("users")
      .update(updates)
      .eq("id", req.user.id)
      .select(
        "id, full_name, email, selected_charity_id, charity_contribution_percent"
      )
      .maybeSingle();

    if (updateError) {
      console.error("Update charity selection error:", updateError);
      return res.status(500).json({
        success: false,
        message: "Unable to update your charity selection.",
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
      message: "Charity selection updated successfully.",
      user,
      charity,
    });
  } catch (error) {
    console.error("Unexpected charity selection error:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred.",
    });
  }
});

export default router;
