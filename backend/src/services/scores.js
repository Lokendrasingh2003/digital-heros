import { supabase } from "../supabase.js";

const SCORE_COLUMNS =
  "id, score_date, stableford_score, created_at, updated_at";

export async function listScores(userId) {
  const { data, error } = await supabase
    .from("golf_scores")
    .select(SCORE_COLUMNS)
    .eq("user_id", userId)
    .order("score_date", { ascending: false })
    .limit(5);

  if (error) throw error;
  return data ?? [];
}

async function trimToLatestFive(userId) {
  const { data: latestScores, error: listError } = await supabase
    .from("golf_scores")
    .select("id")
    .eq("user_id", userId)
    .order("score_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  if (listError) throw listError;

  const keepIds = (latestScores ?? []).map((score) => score.id);

  if (keepIds.length === 0) return;

  const { error: deleteError } = await supabase
    .from("golf_scores")
    .delete()
    .eq("user_id", userId)
    .not("id", "in", `(${keepIds.join(",")})`);

  if (deleteError) throw deleteError;
}

// One score per date. Saving a date that already exists updates it.
// Only the five most recent dates are kept.
export async function saveScore(userId, scoreDate, stablefordScore) {
  const { data: savedScore, error: saveError } = await supabase
    .from("golf_scores")
    .upsert(
      {
        user_id: userId,
        score_date: scoreDate,
        stableford_score: stablefordScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,score_date" }
    )
    .select(SCORE_COLUMNS)
    .single();

  if (saveError) throw saveError;

  await trimToLatestFive(userId);

  return {
    score: savedScore,
    scores: await listScores(userId),
  };
}

export async function updateScore(userId, scoreId, scoreDate, stablefordScore) {
  const { data: existing, error: lookupError } = await supabase
    .from("golf_scores")
    .select("id, score_date")
    .eq("id", scoreId)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!existing) return { notFound: true };

  if (existing.score_date !== scoreDate) {
    const { data: clash, error: clashError } = await supabase
      .from("golf_scores")
      .select("id")
      .eq("user_id", userId)
      .eq("score_date", scoreDate)
      .neq("id", scoreId)
      .maybeSingle();

    if (clashError) throw clashError;

    if (clash) {
      return { conflict: true };
    }
  }

  const { error: updateError } = await supabase
    .from("golf_scores")
    .update({
      score_date: scoreDate,
      stableford_score: stablefordScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scoreId)
    .eq("user_id", userId);

  if (updateError) throw updateError;

  await trimToLatestFive(userId);

  return { scores: await listScores(userId) };
}

export async function removeScore(userId, scoreId) {
  const { data, error } = await supabase
    .from("golf_scores")
    .delete()
    .eq("id", scoreId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) return { notFound: true };

  return { scores: await listScores(userId) };
}
