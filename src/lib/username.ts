export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,24}$/;

export const EMAIL_DOMAIN = "unboss.local";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      ok: false as const,
      error:
        "Usernames must be 3–24 characters and use only letters, numbers, dots, dashes or underscores.",
    };
  }
  return { ok: true as const, username: normalized };
}

export function usernameToEmail(value: string) {
  return `${normalizeUsername(value)}@${EMAIL_DOMAIN}`;
}
