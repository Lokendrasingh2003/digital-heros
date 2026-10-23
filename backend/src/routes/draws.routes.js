import { Router } from "express";
import { supabase } from "../supabase.js";

const router = Router();

// GET /api/draws — public draw board.
// Draft draws are open for entries and never expose simulated numbers.
router.get("/", async (req, res) => {
  try {
    const { data: draws, error } = await supabase
      .from("draws")
      .select(
        "id, draw_month, draw_method, status, drawn_numbers, eligible_subscriber_count, total_prize_pool, jackpot_rollover_in, jackpot_rollover_out, published_at"
      )
      .in("status", ["draft", "published"])
      .order("draw_month", { ascending: false });

    if (error) throw error;

    const publishedIds = (draws ?? [])
      .filter((draw) => draw.status === "published")
      .map((draw) => draw.id);

    let tiers = [];

    if (publishedIds.length > 0) {
      const { data, error: tierError } = await supabase
        .from("draw_prize_tiers")
        .select(
          "draw_id, match_tier, currency, pool_amount, winner_count, amount_per_winner, rollover_amount"
        )
        .in("draw_id", publishedIds);

      if (tierError) throw tierError;
      tiers = data ?? [];
    }

    const open = [];
    const published = [];

    for (const draw of draws ?? []) {
      if (draw.status === "draft") {
        open.push({
          id: draw.id,
          draw_month: draw.draw_month,
          draw_method: draw.draw_method,
          status: draw.status,
        });
        continue;
      }

      published.push({
        ...draw,
        tiers: tiers.filter((tier) => tier.draw_id === draw.id),
      });
    }

    return res.json({
      success: true,
      open,
      published,
    });
  } catch (error) {
    console.error("Fetch public draws error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load draws.",
    });
  }
});

export default router;
