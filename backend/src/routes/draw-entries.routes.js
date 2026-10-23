
import { Router } from "express";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/requireSubscription.js";
const router = Router();

// History stays visible after a subscription lapses. New entries do not.
router.use(authenticateToken);

// GET /api/draw-entries/me
router.get("/me", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("draw_entries")
      .select(`
        id,
        draw_id,
        selected_numbers,
        created_at,
        draws (
          draw_month,
          status,
          drawn_numbers
        )
      `)
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      entries: data ?? [],
    });
  } catch (error) {
    console.error("Fetch draw entries error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch draw entries.",
    });
  }
});

// POST /api/draw-entries
router.post("/", requireActiveSubscription, async (req, res) => {
  try {
    const { drawId, selectedNumbers } = req.body;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(drawId ?? "")) {
      return res.status(400).json({
        success: false,
        message: "Invalid draw ID.",
      });
    }

    if (
      !Array.isArray(selectedNumbers) ||
      selectedNumbers.length !== 5 ||
      !selectedNumbers.every(
        (n) => Number.isInteger(n) && n >= 1 && n <= 45
      ) ||
      new Set(selectedNumbers).size !== 5
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Select exactly five unique numbers between 1 and 45.",
      });
    }

    const { data: draw, error: drawError } = await supabase
      .from("draws")
      .select("id, status")
      .eq("id", drawId)
      .maybeSingle();

    if (drawError) throw drawError;

    if (!draw) {
      return res.status(404).json({
        success: false,
        message: "Draw not found.",
      });
    }

    if (draw.status !== "draft") {
      return res.status(409).json({
        success: false,
        message: "Entries can only be submitted for draft draws.",
      });
    }

    const { data, error } = await supabase
      .from("draw_entries")
      .insert({
        draw_id: drawId,
        user_id: req.user.id,
        selected_numbers: selectedNumbers,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "You have already entered this draw.",
        });
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Draw entry submitted successfully.",
      entry: data,
    });
  } catch (error) {
    console.error("Create draw entry error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit draw entry.",
    });
  }
});

export default router;
