
import { Router } from "express";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

function pickFiveNumbers(weights) {
  const available = Array.from({ length: 45 }, (_, i) => i + 1);
  const selected = [];

  while (selected.length < 5) {
    const totalWeight = available.reduce(
      (sum, number) => sum + weights[number],
      0
    );

    let randomValue = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let i = 0; i < available.length; i++) {
      randomValue -= weights[available[i]];

      if (randomValue < 0) {
        selectedIndex = i;
        break;
      }
    }

    selected.push(available[selectedIndex]);
    available.splice(selectedIndex, 1);
  }

  return selected.sort((a, b) => a - b);
}

// POST /api/admin/draws/:id/simulate
router.post("/:id/simulate", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: draw, error: drawError } = await supabase
      .from("draws")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (drawError) throw drawError;

    if (!draw) {
      return res.status(404).json({
        success: false,
        message: "Draw not found.",
      });
    }

    if (!["draft", "simulated"].includes(draw.status)) {
      return res.status(409).json({
        success: false,
        message: "Only draft or simulated draws can be simulated.",
      });
    }

    if (!["random", "weighted"].includes(draw.draw_method)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported draw method.",
      });
    }

    const now = new Date();

    const { data: subscriptions, error: subscriptionError } =
      await supabase
        .from("subscriptions")
        .select(
          "user_id, amount, currency, current_period_end"
        )
        .eq("status", "active")
        .gt("current_period_end", now.toISOString());

    if (subscriptionError) throw subscriptionError;

    // Count one active subscription per user.
    const activeByUser = new Map();

    for (const subscription of subscriptions ?? []) {
      if (!activeByUser.has(subscription.user_id)) {
        activeByUser.set(subscription.user_id, subscription);
      }
    }

    const activeSubscriptions = [...activeByUser.values()];
    const eligibleUserIds = activeSubscriptions.map(
      (subscription) => subscription.user_id
    );

    let users = [];

    if (eligibleUserIds.length > 0) {
      const { data, error } = await supabase
        .from("users")
        .select("id, charity_contribution_percent")
        .in("id", eligibleUserIds);

      if (error) throw error;
      users = data ?? [];
    }

    const userById = new Map(users.map((user) => [user.id, user]));

    const currencies = new Set(
      activeSubscriptions.map((sub) => (sub.currency || "").toLowerCase())
    );

    if (currencies.size > 1) {
      return res.status(400).json({
        success: false,
        message:
          "Subscriptions use multiple currencies. Calculate separate pools per currency before simulating.",
      });
    }

    // A fixed 50% of each subscription funds the prize pool.
    // Charity is taken first (minimum 10%, member-chosen). If a member
    // gives more than 50% to charity, the prize share shrinks so the
    // charity gift is never reduced. The platform keeps whatever remains.
    const PRIZE_POOL_SHARE = 0.5;

    const subscriptionPrizePool = activeSubscriptions.reduce(
      (sum, subscription) => {
        const user = userById.get(subscription.user_id);
        const contribution = Number(
          user?.charity_contribution_percent ?? 10
        );
        const amount = Number(subscription.amount);

        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error("Invalid subscription amount.");
        }

        if (
          !Number.isFinite(contribution) ||
          contribution < 10 ||
          contribution > 100
        ) {
          throw new Error("Invalid charity contribution percentage.");
        }

        const charityShare = contribution / 100;
        const prizeShare = Math.min(PRIZE_POOL_SHARE, 1 - charityShare);

        return sum + amount * prizeShare;
      },
      0
    );

  
    // Find the most recent earlier published draw.
    const { data: previousDraw, error: previousDrawError } =
      await supabase
        .from("draws")
        .select("id, draw_month, jackpot_rollover_out")
        .eq("status", "published")
        .lt("draw_month", draw.draw_month)
        .order("draw_month", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (previousDrawError) throw previousDrawError;

    // If this draw already has a rollover source, preserve that claim.
    const { data: currentDraw, error: currentDrawError } =
      await supabase
        .from("draws")
        .select("jackpot_rollover_from_draw_id, jackpot_rollover_in")
        .eq("id", id)
        .single();

    if (currentDrawError) throw currentDrawError;

    let rolloverSourceId =
      currentDraw.jackpot_rollover_from_draw_id;

    let incomingRollover = Number(
      currentDraw.jackpot_rollover_in ?? 0
    );

    if (!rolloverSourceId && previousDraw) {
      const candidateRollover = Number(
        previousDraw.jackpot_rollover_out ?? 0
      );

      if (
        !Number.isFinite(candidateRollover) ||
        candidateRollover < 0
      ) {
        throw new Error("Invalid incoming jackpot rollover.");
      }

      if (candidateRollover > 0) {
        // Check whether another draw already claimed this source.
        const { data: existingClaim, error: claimError } =
          await supabase
            .from("draws")
            .select("id")
            .eq("jackpot_rollover_from_draw_id", previousDraw.id)
            .maybeSingle();

        if (claimError) throw claimError;

        if (existingClaim && existingClaim.id !== id) {
          return res.status(409).json({
            success: false,
            message:
              "This jackpot rollover has already been claimed by another draw.",
          });
        }

        rolloverSourceId = previousDraw.id;
        incomingRollover = candidateRollover;
      } else {
        incomingRollover = 0;
      }
    }

    if (
      !Number.isFinite(incomingRollover) ||
      incomingRollover < 0
    ) {
      throw new Error("Invalid incoming jackpot rollover.");
    }

    const totalPrizePool = Number(
      (subscriptionPrizePool + incomingRollover).toFixed(2)
    );



    const currency = [...currencies][0] || null;

    // A score frequency influences the chance of selecting that number.
    // If a number has never appeared as a Stableford score, use weight 1.
    const weights = Array(46).fill(1);

    if (draw.draw_method === "weighted") {
      const { data: scores, error: scoresError } = await supabase
        .from("golf_scores")
        .select("stableford_score")
        .gte("stableford_score", 1)
        .lte("stableford_score", 45);

      if (scoresError) throw scoresError;

      for (const score of scores ?? []) {
        weights[score.stableford_score] += 1;
      }
    }

    const drawnNumbers = pickFiveNumbers(weights);

    const fiveMatch = Number((totalPrizePool * 0.40).toFixed(2));
const fourMatch = Number((totalPrizePool * 0.35).toFixed(2));

const threeMatch = Number(
  (totalPrizePool - fiveMatch - fourMatch).toFixed(2)
);

const tierPools = {
  fiveMatch,
  fourMatch,
  threeMatch,
};
   
const { data: simulationResult, error: updateError } =
  await supabase.rpc("simulate_draw_atomic", {
    p_draw_id: id,
    p_drawn_numbers: drawnNumbers,
    p_eligible_subscriber_count: activeSubscriptions.length,
    p_total_prize_pool: totalPrizePool,
    p_jackpot_rollover_in: incomingRollover,
    p_rollover_source_id: rolloverSourceId,
  });

if (updateError) throw updateError;

const { data: updatedDraw, error: fetchError } = await supabase
  .from("draws")
  .select("*")
  .eq("id", id)
  .single();

if (fetchError) throw fetchError;


    return res.json({
      success: true,
      message: "Draw simulation completed. Results are not published.",
      draw: updatedDraw,
      prizePoolEstimate: {
        currency,
        total: updatedDraw.total_prize_pool,
        tiers: tierPools,
        note:
          "Provisional pool estimate after charity contributions. Confirm prize funding and rollover rules before publishing.",
      },
    });
  } catch (error) {
  console.error("Simulate draw error:", error.message);

  // PostgreSQL unique_violation
  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message:
        "This jackpot rollover has already been claimed by another draw.",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Unable to simulate draw.",
  });
}
});

export default router;
