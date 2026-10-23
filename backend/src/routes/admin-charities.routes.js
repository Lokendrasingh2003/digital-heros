
import { Router } from "express";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateCharity(body, partial = false) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      errors.push("Name is required.");
    }
  }

  for (const field of ["description", "category"]) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== "string"
    ) {
      errors.push(`${field} must be text.`);
    }
  }

  for (const field of ["image_url", "website_url"]) {
    if (body[field] !== undefined && body[field] !== null) {
      if (typeof body[field] !== "string") {
        errors.push(`${field} must be a URL.`);
        continue;
      }

      try {
        const url = new URL(body[field]);
        if (!["http:", "https:"].includes(url.protocol)) {
          errors.push(`${field} must use HTTP or HTTPS.`);
        }
      } catch {
        errors.push(`${field} must be a valid URL.`);
      }
    }
  }

  if (
    body.is_featured !== undefined &&
    typeof body.is_featured !== "boolean"
  ) {
    errors.push("is_featured must be true or false.");
  }

  if (
    body.is_active !== undefined &&
    typeof body.is_active !== "boolean"
  ) {
    errors.push("is_active must be true or false.");
  }

  return errors;
}

// GET /api/admin/charities
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("charities")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      count: data.length,
      charities: data,
    });
  } catch (error) {
    console.error("Admin charity list error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch charities.",
    });
  }
});

// POST /api/admin/charities
router.post("/", async (req, res) => {
  try {
    const errors = validateCharity(req.body);

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: errors.join(" "),
      });
    }

    const payload = {
      name: req.body.name.trim(),
      description: req.body.description?.trim() || null,
      category: req.body.category?.trim() || null,
      image_url: req.body.image_url || null,
      website_url: req.body.website_url || null,
      is_featured: req.body.is_featured ?? false,
      is_active: req.body.is_active ?? true,
    };

    const { data, error } = await supabase
      .from("charities")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: "Charity created successfully.",
      charity: data,
    });
  } catch (error) {
    console.error("Create charity error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to create charity.",
    });
  }
});

router.get("/events", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("charity_events")
      .select("id, charity_id, title, description, event_date, image_url, created_at")
      .order("event_date", { ascending: true });

    if (error) throw error;

    return res.json({ success: true, events: data ?? [] });
  } catch (error) {
    console.error("List charity events error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load events.",
    });
  }
});

router.post("/:id/events", async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid charity ID.",
      });
    }

    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const description =
      typeof req.body.description === "string" ? req.body.description.trim() : "";

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Event title is required.",
      });
    }

    const { data, error } = await supabase
      .from("charity_events")
      .insert({
        charity_id: req.params.id,
        title,
        description,
        event_date: req.body.eventDate || null,
        image_url: req.body.imageUrl || null,
      })
      .select("*")
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: "Event created.",
      event: data,
    });
  } catch (error) {
    console.error("Create charity event error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to create event.",
    });
  }
});

router.delete("/events/:eventId", async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID.",
      });
    }

    const { error } = await supabase
      .from("charity_events")
      .delete()
      .eq("id", req.params.eventId);

    if (error) throw error;

    return res.json({ success: true, message: "Event deleted." });
  } catch (error) {
    console.error("Delete charity event error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to delete event.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid charity ID.",
      });
    }

    const { count, error: donationError } = await supabase
      .from("donations")
      .select("id", { count: "exact", head: true })
      .eq("charity_id", req.params.id);

    if (donationError) throw donationError;

    if (count > 0) {
      return res.status(409).json({
        success: false,
        message:
          "This charity has donations, so it cannot be deleted. Deactivate it instead.",
      });
    }

    await supabase
      .from("users")
      .update({ selected_charity_id: null })
      .eq("selected_charity_id", req.params.id);

    await supabase.from("charity_events").delete().eq("charity_id", req.params.id);

    const { error } = await supabase.from("charities").delete().eq("id", req.params.id);

    if (error) throw error;

    return res.json({ success: true, message: "Charity deleted." });
  } catch (error) {
    console.error("Delete charity error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to delete charity.",
    });
  }
});

// PATCH /api/admin/charities/:id
router.patch("/:id", async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid charity ID.",
      });
    }

    const allowedFields = [
      "name",
      "description",
      "category",
      "image_url",
      "website_url",
      "is_featured",
      "is_active",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    const errors = validateCharity(updates, true);

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: errors.join(" "),
      });
    }

    if (updates.name !== undefined) {
      updates.name = updates.name.trim();
    }

    for (const field of ["description", "category"]) {
      if (typeof updates[field] === "string") {
        updates[field] = updates[field].trim() || null;
      }
    }

    const { data, error } = await supabase
      .from("charities")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Charity not found.",
      });
    }

    return res.json({
      success: true,
      message: "Charity updated successfully.",
      charity: data,
    });
  } catch (error) {
    console.error("Update charity error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update charity.",
    });
  }
});

export default router;
