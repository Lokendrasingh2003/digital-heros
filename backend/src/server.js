
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabase.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import scoresRoutes from "./routes/scores.routes.js";
import charitiesRoutes from "./routes/charities.routes.js";
import subscriptionsRoutes from "./routes/subscriptions.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import subscriberRoutes from "./routes/subscriber.routes.js";
import adminCharitiesRoutes from "./routes/admin-charities.routes.js";
import adminDrawsRoutes from "./routes/admin-draws.routes.js";
import adminDrawSimulationRoutes from "./routes/admin-draw-simulation.routes.js";
import adminDrawPublishRoutes from "./routes/admin-draw-publish.routes.js";
import drawEntriesRoutes from "./routes/draw-entries.routes.js";
import drawsRoutes from "./routes/draws.routes.js";
import winningsRoutes from "./routes/winnings.routes.js";
import donationsRoutes from "./routes/donations.routes.js";
import adminUsersRoutes from "./routes/admin-users.routes.js";
import adminWinnersRoutes from "./routes/admin-winners.routes.js";
import adminReportsRoutes from "./routes/admin-reports.routes.js";
dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

app.use(
  "/api/checkout/webhook",
  express.raw({ type: "application/json" }),
  webhookRoutes
);

app.use(express.json());
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/scores", scoresRoutes);
app.use("/api/charities", charitiesRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/subscriber", subscriberRoutes);
app.use("/api/admin/charities", adminCharitiesRoutes);
app.use("/api/admin/draws", adminDrawsRoutes);
app.use("/api/admin/draws", adminDrawSimulationRoutes);
app.use("/api/admin/draws", adminDrawPublishRoutes);
app.use("/api/draw-entries", drawEntriesRoutes);
app.use("/api/draws", drawsRoutes);
app.use("/api/winnings", winningsRoutes);
app.use("/api/donations", donationsRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/admin/winners", adminWinnersRoutes);
app.use("/api/admin/reports", adminReportsRoutes);


// Health-check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Digital Heroes API is running!",
    timestamp: new Date().toISOString(),
  });
});


app.get("/api/health/database", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("charities")
      .select("id, name")
      .limit(5);

    if (error) {
      console.error("Database query failed:", error.message);

      return res.status(500).json({
        success: false,
        message: "Database query failed",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Supabase database connection successful",
      charityCountReturned: data.length,
      charities: data,
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to connect to the database",
    });
  }
});


// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Digital Heroes API running at http://localhost:${PORT}`);
});
