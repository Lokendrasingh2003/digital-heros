import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/requireSubscription.js";
import {
  listScores,
  removeScore,
  saveScore,
  updateScore,
} from "../services/scores.js";

const router = Router();

const scoreSchema = z
  .object({
    scoreDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format."),
    stablefordScore: z.number().int().min(1).max(45),
  })
  .refine(
    ({ scoreDate }) => {
      const date = new Date(`${scoreDate}T00:00:00.000Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === scoreDate
      );
    },
    {
      message: "Please provide a valid calendar date.",
      path: ["scoreDate"],
    }
  );

const idSchema = z.string().uuid();

function validationError(res, validation) {
  return res.status(400).json({
    success: false,
    message: validation.error.issues[0]?.message || "Invalid score data.",
  });
}

// GET /api/scores — latest five scores, newest date first.
router.get("/", authenticateToken, async (req, res) => {
  try {
    const scores = await listScores(req.user.id);
    return res.json({ success: true, scores });
  } catch (error) {
    console.error("Fetch golf scores error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch golf scores.",
    });
  }
});

// POST /api/scores — add a score, or edit the score already stored for that date.
router.post(
  "/",
  authenticateToken,
  requireActiveSubscription,
  async (req, res) => {
    try {
      const validation = scoreSchema.safeParse(req.body);

      if (!validation.success) {
        return validationError(res, validation);
      }

      const { scoreDate, stablefordScore } = validation.data;
      const result = await saveScore(req.user.id, scoreDate, stablefordScore);

      return res.status(200).json({
        success: true,
        message: "Golf score saved successfully.",
        score: result.score,
        scores: result.scores,
      });
    } catch (error) {
      console.error("Save golf score error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to save golf score.",
      });
    }
  }
);

// PATCH /api/scores/:id — edit one retained score.
router.patch(
  "/:id",
  authenticateToken,
  requireActiveSubscription,
  async (req, res) => {
    try {
      if (!idSchema.safeParse(req.params.id).success) {
        return res.status(400).json({
          success: false,
          message: "Invalid score ID.",
        });
      }

      const validation = scoreSchema.safeParse(req.body);

      if (!validation.success) {
        return validationError(res, validation);
      }

      const { scoreDate, stablefordScore } = validation.data;
      const result = await updateScore(
        req.user.id,
        req.params.id,
        scoreDate,
        stablefordScore
      );

      if (result.notFound) {
        return res.status(404).json({
          success: false,
          message: "Score not found.",
        });
      }

      if (result.conflict) {
        return res.status(409).json({
          success: false,
          message:
            "A score already exists for that date. Edit or delete that entry instead.",
        });
      }

      return res.json({
        success: true,
        message: "Golf score updated.",
        scores: result.scores,
      });
    } catch (error) {
      console.error("Update golf score error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update golf score.",
      });
    }
  }
);

// DELETE /api/scores/:id — remove one retained score. Purged history is not restored.
router.delete(
  "/:id",
  authenticateToken,
  requireActiveSubscription,
  async (req, res) => {
    try {
      if (!idSchema.safeParse(req.params.id).success) {
        return res.status(400).json({
          success: false,
          message: "Invalid score ID.",
        });
      }

      const result = await removeScore(req.user.id, req.params.id);

      if (result.notFound) {
        return res.status(404).json({
          success: false,
          message: "Score not found.",
        });
      }

      return res.json({
        success: true,
        message: "Golf score deleted.",
        scores: result.scores,
      });
    } catch (error) {
      console.error("Delete golf score error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to delete golf score.",
      });
    }
  }
);

export default router;
