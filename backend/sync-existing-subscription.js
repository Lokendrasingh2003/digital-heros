import "dotenv/config";
import Stripe from "stripe";
import { supabase } from "./src/supabase.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const subscriptionId = "sub_1UTK5I3zAaCoE9nyTTY8Qdno";

async function syncExistingSubscription() {
  try {
    const subscription =
      await stripe.subscriptions.retrieve(subscriptionId);

    const item = subscription.items?.data?.[0];

    const periodStart =
      subscription.current_period_start ??
      item?.current_period_start;

    const periodEnd =
      subscription.current_period_end ??
      item?.current_period_end;

    if (!periodStart || !periodEnd) {
      throw new Error(
        "Stripe did not return valid subscription period dates."
      );
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        current_period_start: new Date(
          periodStart * 1000
        ).toISOString(),
        current_period_end: new Date(
          periodEnd * 1000
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("provider_subscription_id", subscription.id)
      .select("id, status, current_period_start, current_period_end")
      .single();

    if (error) throw error;

    console.log("Subscription dates updated successfully:");
    console.log(data);
  } catch (error) {
    console.error("Subscription repair failed:", error.message);
    process.exitCode = 1;
  }
}

syncExistingSubscription();