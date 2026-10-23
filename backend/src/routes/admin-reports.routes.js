import { Router } from "express";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

function isLive(subscription) {
  if (subscription.status !== "active" || !subscription.current_period_end) {
    return false;
  }

  return new Date(subscription.current_period_end).getTime() > Date.now();
}

router.get("/", async (req, res) => {
  try {
    const [
      usersResult,
      subscriptionsResult,
      drawsResult,
      winnersResult,
      donationsResult,
      charitiesResult,
    ] = await Promise.all([
      supabase.from("users").select("id, selected_charity_id, charity_contribution_percent, role"),
      supabase
        .from("subscriptions")
        .select("user_id, amount, currency, status, current_period_end, plan"),
      supabase
        .from("draws")
        .select("id, status, total_prize_pool, draw_month, eligible_subscriber_count"),
      supabase
        .from("winners")
        .select("id, verification_status, payout_status, prize_amount, match_tier"),
      supabase
        .from("donations")
        .select("charity_id, amount, payment_status"),
      supabase.from("charities").select("id, name"),
    ]);

    for (const result of [
      usersResult,
      subscriptionsResult,
      drawsResult,
      winnersResult,
      donationsResult,
      charitiesResult,
    ]) {
      if (result.error) throw result.error;
    }

    const users = usersResult.data ?? [];
    const subscriptions = subscriptionsResult.data ?? [];
    const draws = drawsResult.data ?? [];
    const winners = winnersResult.data ?? [];
    const donations = donationsResult.data ?? [];
    const charities = charitiesResult.data ?? [];

    const liveSubscriptions = [];
    const seenUsers = new Set();

    const sortedSubs = [...subscriptions].sort((a, b) => {
      const aEnd = a.current_period_end ? new Date(a.current_period_end).getTime() : 0;
      const bEnd = b.current_period_end ? new Date(b.current_period_end).getTime() : 0;
      return bEnd - aEnd;
    });

    for (const subscription of sortedSubs) {
      if (seenUsers.has(subscription.user_id)) continue;
      seenUsers.add(subscription.user_id);
      if (isLive(subscription)) liveSubscriptions.push(subscription);
    }

    const userById = new Map(users.map((user) => [user.id, user]));
    const charityName = new Map(charities.map((charity) => [charity.id, charity.name]));

    const charityTotals = new Map();

    function addCharity(charityId, amount) {
      if (!charityId || !Number.isFinite(amount) || amount <= 0) return;
      const current = charityTotals.get(charityId) || {
        charityId,
        name: charityName.get(charityId) || "Unknown charity",
        fromSubscriptions: 0,
        fromDonations: 0,
      };
      charityTotals.set(charityId, current);
      return current;
    }

    for (const subscription of liveSubscriptions) {
      const user = userById.get(subscription.user_id);
      const percent = Number(user?.charity_contribution_percent ?? 10);
      const share = Number(subscription.amount) * (percent / 100);
      const bucket = addCharity(user?.selected_charity_id, share);
      if (bucket) bucket.fromSubscriptions += share;
    }

    for (const donation of donations) {
      if (donation.payment_status !== "paid") continue;
      const bucket = addCharity(donation.charity_id, Number(donation.amount));
      if (bucket) bucket.fromDonations += Number(donation.amount);
    }

    const charityContributions = [...charityTotals.values()]
      .map((item) => ({
        ...item,
        fromSubscriptions: Number(item.fromSubscriptions.toFixed(2)),
        fromDonations: Number(item.fromDonations.toFixed(2)),
        total: Number((item.fromSubscriptions + item.fromDonations).toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total);

    const drawCounts = { draft: 0, simulated: 0, published: 0 };

    for (const draw of draws) {
      if (drawCounts[draw.status] !== undefined) drawCounts[draw.status] += 1;
    }

    const publishedPool = draws
      .filter((draw) => draw.status === "published")
      .reduce((sum, draw) => sum + Number(draw.total_prize_pool || 0), 0);

    return res.json({
      success: true,
      report: {
        totalUsers: users.filter((user) => user.role !== "admin").length,
        totalAccounts: users.length,
        activeSubscriptions: liveSubscriptions.length,
        plans: {
          monthly: liveSubscriptions.filter((item) => item.plan === "monthly").length,
          yearly: liveSubscriptions.filter((item) => item.plan === "yearly").length,
        },
        totalPrizePool: Number(publishedPool.toFixed(2)),
        charityContributions,
        charityTotal: Number(
          charityContributions.reduce((sum, item) => sum + item.total, 0).toFixed(2)
        ),
        draws: drawCounts,
        winners: {
          total: winners.length,
          pending: winners.filter((item) => item.verification_status === "pending").length,
          approved: winners.filter((item) => item.verification_status === "approved").length,
          rejected: winners.filter((item) => item.verification_status === "rejected").length,
          paid: winners.filter((item) => item.payout_status === "paid").length,
        },
      },
    });
  } catch (error) {
    console.error("Admin report error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to build the report.",
    });
  }
});

export default router;
