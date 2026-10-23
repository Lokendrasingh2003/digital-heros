export function formatDate(date) {
  if (!date) return "Not available";

  const parsed = new Date(String(date).includes("T") ? date : `${date}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) return "Not available";

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatMonth(date) {
  if (!date) return "Date unavailable";

  const parsed = new Date(`${String(date).slice(0, 10)}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) return "Date unavailable";

  return parsed.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function formatStatus(status) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatMoney(amount, currency = "USD") {
  const value = Number(amount);

  if (!Number.isFinite(value)) return "—";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || ""}`.trim();
  }
}

export function todayInputValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
