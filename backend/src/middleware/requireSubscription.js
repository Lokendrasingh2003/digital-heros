
import { supabase } from "../supabase.js";

export async function requireActiveSubscription(req, res, next) {
  try {
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("id, status, current_period_end")
      .eq("user_id", req.user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Subscription lookup failed:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to verify subscription status.",
      });
    }

    const periodEnd = subscription?.current_period_end
      ? new Date(subscription.current_period_end).getTime()
      : null;

    const isActive =
      subscription?.status === "active" &&
      periodEnd !== null &&
      Number.isFinite(periodEnd) &&
      periodEnd > Date.now();

    if (!isActive) {
      return res.status(403).json({
        success: false,
        message: "An active subscription is required to access this feature.",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("Subscription middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify subscription status.",
    });
  }
}
