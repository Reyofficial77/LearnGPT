import { randomBytes } from "crypto";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"; // 36 chars
const LIMIT = 256 - (256 % ALPHABET.length); // 252 -> rejection sampling, no modulo bias

/** Generates an id like "k3f9a-0zq1m-x7b2c-p8d4e-w5n6r" using a CSPRNG. */
export function generateChatId(): string {
  let out = "";
  while (out.length < 25) {
    for (const byte of randomBytes(32)) {
      if (byte >= LIMIT) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === 25) break;
    }
  }
  return out.match(/.{5}/g)!.join("-");
}
