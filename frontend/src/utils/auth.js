
const TOKEN_KEY = "dh_token";
const USER_KEY = "dh_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const user = localStorage.getItem(USER_KEY);

  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
