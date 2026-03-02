import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

export function createTgClient(sessionString = ""): TelegramClient {
  const apiId = Number(process.env.API_ID);
  const apiHash = process.env.API_HASH;

  if (!apiId || !apiHash) {
    throw new Error("API_ID and API_HASH must be set in environment");
  }

  const session = new StringSession(sessionString);
  return new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 3,
  });
}

// In-memory store for pending login flows.
// Key: `${userId}:${phone}`, Value: { client, phoneCodeHash }
// Entries are auto-cleaned after 5 minutes.
interface PendingLogin {
  client: TelegramClient;
  phoneCodeHash: string;
  createdAt: number;
}

const pendingLogins = new Map<string, PendingLogin>();

const PENDING_TTL_MS = 5 * 60 * 1000;

function cleanExpired() {
  const now = Date.now();
  for (const [key, entry] of pendingLogins) {
    if (now - entry.createdAt > PENDING_TTL_MS) {
      entry.client.disconnect().catch(() => {});
      pendingLogins.delete(key);
    }
  }
}

export function setPendingLogin(
  userId: string,
  phone: string,
  client: TelegramClient,
  phoneCodeHash: string
) {
  cleanExpired();
  const key = `${userId}:${phone}`;
  pendingLogins.set(key, { client, phoneCodeHash, createdAt: Date.now() });
}

export function getPendingLogin(userId: string, phone: string) {
  cleanExpired();
  return pendingLogins.get(`${userId}:${phone}`) ?? null;
}

export function removePendingLogin(userId: string, phone: string) {
  const key = `${userId}:${phone}`;
  const entry = pendingLogins.get(key);
  if (entry) {
    entry.client.disconnect().catch(() => {});
    pendingLogins.delete(key);
  }
}
