import { gcm } from "@noble/ciphers/aes";
import { randomBytes } from "@noble/ciphers/webcrypto";

function getKey(): Uint8Array {
  const hex = process.env.SESSION_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "SESSION_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"
    );
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export function encryptSession(plaintext: string): {
  ciphertext: string;
  iv: string;
  tag: string;
} {
  const key = getKey();
  const iv = randomBytes(12);
  const aes = gcm(key, iv);

  const plaintextBytes = new TextEncoder().encode(plaintext);
  const sealed = aes.encrypt(plaintextBytes);

  // GCM sealed output = ciphertext + 16-byte tag
  const ciphertextBytes = sealed.slice(0, sealed.length - 16);
  const tagBytes = sealed.slice(sealed.length - 16);

  return {
    ciphertext: Buffer.from(ciphertextBytes).toString("hex"),
    iv: Buffer.from(iv).toString("hex"),
    tag: Buffer.from(tagBytes).toString("hex"),
  };
}

export function decryptSession(
  ciphertextHex: string,
  ivHex: string,
  tagHex: string
): string {
  const key = getKey();
  const iv = Uint8Array.from(Buffer.from(ivHex, "hex"));
  const aes = gcm(key, iv);

  const ciphertextBytes = Buffer.from(ciphertextHex, "hex");
  const tagBytes = Buffer.from(tagHex, "hex");

  // Reconstruct sealed = ciphertext + tag
  const sealed = new Uint8Array(ciphertextBytes.length + tagBytes.length);
  sealed.set(ciphertextBytes, 0);
  sealed.set(tagBytes, ciphertextBytes.length);

  const decrypted = aes.decrypt(sealed);
  return new TextDecoder().decode(decrypted);
}
