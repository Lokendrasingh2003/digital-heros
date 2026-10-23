
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { supabase } from "../supabase.js";

const router = Router();

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
  selectedCharityId: z.string().uuid(),
});

router.post("/signup", async (req, res) => {
  try {
    const validation = signupSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Please check your signup details.",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { fullName, password, selectedCharityId } = validation.data;
    const email = validation.data.email.toLowerCase();

    // Confirm that the email is not already registered.
    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) {
      console.error("User lookup failed:", lookupError.message);

      return res.status(500).json({
        success: false,
        message: "Unable to process signup right now.",
      });
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // If a charity was selected, verify it exists and is active.
    if (selectedCharityId) {
      const { data: charity, error: charityError } = await supabase
        .from("charities")
        .select("id")
        .eq("id", selectedCharityId)
        .eq("is_active", true)
        .maybeSingle();

      if (charityError) {
        console.error("Charity lookup failed:", charityError.message);

        return res.status(500).json({
          success: false,
          message: "Unable to verify the selected charity.",
        });
      }

      if (!charity) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid active charity.",
        });
      }
    }

    // Never store a plain-text password.
    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error: insertError } = await supabase
      .from("users")
      .insert({
        full_name: fullName,
        email,
        password_hash: passwordHash,
        selected_charity_id: selectedCharityId || null,
        charity_contribution_percent: 10,
      })
      .select(
        "id, full_name, email, role, selected_charity_id, charity_contribution_percent, created_at"
      )
      .single();

    if (insertError) {
      // Handle a duplicate email safely, including concurrent requests.
      if (insertError.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }

      console.error("User creation failed:", insertError.message);

      return res.status(500).json({
        success: false,
        message: "Unable to create your account right now.",
      });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(201).json({
      success: true,
      message: "Your account has been created successfully.",
      token,
      user,
    });
  } catch (error) {
    console.error("Signup failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred during signup.",
    });
  }
});


router.get("/charities", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("charities")
      .select("id, name, category")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to load charities:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to load charities.",
      });
    }

    return res.status(200).json({
      success: true,
      charities: data,
    });
  } catch (error) {
    console.error("Charity request failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load charities.",
    });
  }
});



const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

router.post("/login", async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email and password.",
      });
    }

    const email = validation.data.email.toLowerCase();
    const { password } = validation.data;

    const { data: user, error } = await supabase
      .from("users")
      .select(
        "id, full_name, email, password_hash, role, selected_charity_id, charity_contribution_percent"
      )
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Login lookup failed:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to log in right now.",
      });
    }

    // Use the same response for an unknown email and a wrong password.
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const safeUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      selected_charity_id: user.selected_charity_id,
      charity_contribution_percent: user.charity_contribution_percent,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred during login.",
    });
  }
});


export default router;
