
import { Router } from "express";
import Stripe from "stripe";
import { supabase } from "../supabase.js";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function mapSubscriptionStatus(status) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled") return "cancelled";
  return "inactive";
}

async function syncSubscription(subscription, fallbackUserId, fallbackPlan) {
  const subscriptionId = subscription.id;

  // Reuse the existing database record if metadata is missing.
  const { data: existing, error: lookupError } = await supabase
    .from("subscriptions")
    .select("user_id, plan")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const userId =
    subscription.metadata?.userId ||
    fallbackUserId ||
    existing?.user_id;

  const plan =
    subscription.metadata?.plan ||
    fallbackPlan ||
    existing?.plan;

  if (!userId || !["monthly", "yearly"].includes(plan)) {
    throw new Error("Missing user ID or subscription plan.");
  }

  const subscriptionItem = subscription.items?.data?.[0];

const periodStart =
  subscription.current_period_start ??
  subscriptionItem?.current_period_start ??
  null;

const periodEnd =
  subscription.current_period_end ??
  subscriptionItem?.current_period_end ??
  null;

  const price = subscription.items?.data?.[0]?.price;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const record = {
    user_id: userId,
    plan,
    status: mapSubscriptionStatus(subscription.status),
    amount: (price?.unit_amount ?? 0) / 100,
    currency: price?.currency ?? "usd",
    provider: "stripe",
    provider_customer_id: customerId ?? null,
    provider_subscription_id: subscriptionId,
    current_period_start: periodStart
  ? new Date(periodStart * 1000).toISOString()
  : null,

current_period_end: periodEnd
  ? new Date(periodEnd * 1000).toISOString()
  : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("subscriptions")
    .upsert(record, { onConflict: "provider_subscription_id" });

  if (error) throw error;
}

router.post("/", async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!webhookSecret) {
    return res.status(500).send("Stripe webhook secret is not configured.");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error.message);
    return res.status(400).send("Invalid webhook signature.");
  }

  try {
    const object = event.data.object;

    switch (event.type) {
      case "checkout.session.completed": {
        if (object.metadata?.type === "donation" && object.metadata.donationId) {
          const { error: donationError } = await supabase
            .from("donations")
            .update({
              payment_status: "paid",
              provider_payment_id:
                (typeof object.payment_intent === "string"
                  ? object.payment_intent
                  : object.payment_intent?.id) || object.id,
            })
            .eq("id", object.metadata.donationId);

          if (donationError) throw donationError;
          break;
        }

        if (object.mode === "subscription" && object.subscription) {
          const subscriptionId =
            typeof object.subscription === "string"
              ? object.subscription
              : object.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId
          );

          await syncSubscription(
            subscription,
            object.metadata?.userId || object.client_reference_id,
            object.metadata?.plan
          );
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(object);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        // Stripe invoice fields can vary by API version.
        const subscriptionId =
          object.subscription ||
          object.parent?.subscription_details?.subscription;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            typeof subscriptionId === "string"
              ? subscriptionId
              : subscriptionId.id
          );

          await syncSubscription(subscription);
        }
        break;
      }

      default:
        // Other Stripe events are intentionally ignored.
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    return res.status(500).json({ message: "Webhook processing failed." });
  }
});

export default router;
