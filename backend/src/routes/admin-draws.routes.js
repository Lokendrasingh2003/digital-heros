
import { Router } from "express";
import { supabase } from "../supabase.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

// GET /api/admin/draws
router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("draws")
            .select("*")
            .order("draw_month", { ascending: false });

        if (error) throw error;

        return res.json({
            success: true,
            count: data.length,
            draws: data,
        });
    } catch (error) {
        console.error("Fetch admin draws error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch draws.",
        });
    }
});

// POST /api/admin/draws
router.post("/", async (req, res) => {
    try {
        const { drawMonth, drawMethod = "random" } = req.body;

        if (
            typeof drawMonth !== "string" ||
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(drawMonth)
        ) {
            return res.status(400).json({
                success: false,
                message: "drawMonth must use YYYY-MM format.",
            });
        }

        if (!["random", "weighted"].includes(drawMethod)) {
            return res.status(400).json({
                success: false,
                message: "drawMethod must be random or weighted.",
            });
        }

        const { data: existing, error: lookupError } = await supabase
            .from("draws")
            .select("id")
            .eq("draw_month", `${drawMonth}-01`)
            .maybeSingle();

        if (lookupError) throw lookupError;

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "A draw already exists for this month.",
            });
        }

        const { data: draw, error } = await supabase
            .from("draws")
            .insert({
                draw_month: `${drawMonth}-01`,
                draw_method: drawMethod,
                status: "draft",
            })
            .select("*")
            .single();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: "Draft draw created successfully.",
            draw,
        });
    } catch (error) {
        console.error("Create admin draw error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to create draw.",
        });
    }
});

export default router;
