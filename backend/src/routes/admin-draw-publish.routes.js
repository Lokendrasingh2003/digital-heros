
import { Router } from "express";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

// POST /api/admin/draws/:id/publish
router.post("/:id/publish", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID before calling the database.
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid draw ID.",
      });
    }

    // The database function creates winners, saves prize tiers,
    // and publishes the draw within one transaction.
    const { data, error } = await supabase.rpc(
      "publish_draw_atomic",
      {
        p_draw_id: id,
      }
    );

    if (error) {
      console.error("Atomic draw publishing error:", error.message);

      if (
        error.message?.includes("Draw not found")
      ) {
        return res.status(404).json({
          success: false,
          message: "Draw not found.",
        });
      }

      if (
        error.message?.includes("Only simulated draws")
      ) {
        return res.status(409).json({
          success: false,
          message: "Only simulated draws can be published.",
        });
      }

      if (
        error.message?.includes("exactly five numbers")
      ) {
        return res.status(400).json({
          success: false,
          message: "The draw must have five simulated numbers.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to publish draw.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Draw published successfully.",
      result: data,
      note:
        "Winner verification and payout remain pending. Confirm prize allocation and rollover rules before production use.",
    });
  } catch (error) {
    console.error("Publish draw error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to publish draw.",
    });
  }
});

export default router;
