// In-memory OTP store with 5-minute TTL.
// For production, replace with Redis or DB-backed store.

interface OtpEntry {
  code: string;
  createdAt: number;
}

const store = new Map<string, OtpEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const attemptCounts = new Map<string, number>();

// One-time auth tokens granted after OTP verification (2-min TTL)
const authTokens = new Map<string, { email: string; createdAt: number }>();
const AUTH_TOKEN_TTL_MS = 2 * 60 * 1000;

function cleanExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(key);
      attemptCounts.delete(key);
    }
  }
  for (const [token, entry] of authTokens) {
    if (now - entry.createdAt > AUTH_TOKEN_TTL_MS) {
      authTokens.delete(token);
    }
  }
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function storeOtp(email: string, code: string) {
  cleanExpired();
  const key = email.toLowerCase().trim();
  store.set(key, { code, createdAt: Date.now() });
  attemptCounts.set(key, 0);
}

export function verifyOtp(
  email: string,
  code: string
): { valid: boolean; error?: string; authToken?: string } {
  cleanExpired();
  const key = email.toLowerCase().trim();
  const entry = store.get(key);

  if (!entry) {
    return { valid: false, error: "No code found. Please request a new one." };
  }

  const attempts = attemptCounts.get(key) ?? 0;
  if (attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    attemptCounts.delete(key);
    return { valid: false, error: "Too many attempts. Request a new code." };
  }

  if (entry.code !== code) {
    attemptCounts.set(key, attempts + 1);
    return { valid: false, error: "Invalid code." };
  }

  // Success — consume the OTP and issue an auth token
  store.delete(key);
  attemptCounts.delete(key);
  // Edge Runtime compatible: use Web Crypto API
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  authTokens.set(token, { email: key, createdAt: Date.now() });
  return { valid: true, authToken: token };
}

/** Consume a one-time auth token. Returns the email if valid, null otherwise. */
export function consumeAuthToken(token: string): string | null {
  cleanExpired();
  const entry = authTokens.get(token);
  if (!entry) return null;
  authTokens.delete(token);
  return entry.email;
}
