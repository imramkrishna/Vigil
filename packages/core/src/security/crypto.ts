import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const CURRENT_KEY_VERSION = 1;
const MAX_LOG_MESSAGE_CHARS = 4000;

/**
 * Resolves the 32-byte master encryption key from `CREDENTIALS_ENCRYPTION_KEY`.
 * Accepts either a 64-char hex string or a base64-encoded 32-byte value.
 * Fails fast if missing or invalid — never silently falls back to plaintext.
 */
function resolveMasterKey(overrideKey?: string): Buffer {
  const raw = (overrideKey ?? process.env.CREDENTIALS_ENCRYPTION_KEY ?? "").trim();
  if (!raw) {
    throw new Error(
      "Server configuration error: CREDENTIALS_ENCRYPTION_KEY is required to encrypt or decrypt integration secrets."
    );
  }

  let keyBuf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    keyBuf = Buffer.from(raw, "hex");
  } else {
    keyBuf = Buffer.from(raw, "base64");
  }

  if (keyBuf.length !== 32) {
    throw new Error(
      "Server configuration error: CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex chars or 44-char base64)."
    );
  }

  return keyBuf;
}

/**
 * Encrypts a secret string using AES-256-GCM.
 * Format: `<iv_base64>:<authTag_base64>:<ciphertext_base64>`.
 */
export function encryptSecret(
  plaintext: string,
  overrideKey?: string
): { ciphertext: string; keyVersion: number } {
  const key = resolveMasterKey(overrideKey);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`,
    keyVersion: CURRENT_KEY_VERSION,
  };
}

/**
 * Decrypts an AES-256-GCM payload produced by `encryptSecret`.
 */
export function decryptSecret(payload: string, overrideKey?: string): string {
  const key = resolveMasterKey(overrideKey);
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format.");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64!, "base64");
  const authTag = Buffer.from(tagB64!, "base64");
  const ciphertext = Buffer.from(dataB64!, "base64");

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Corrupted encrypted secret parameters.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Generates a one-time push ingest token for generic Linux VPS / Log Drains.
 * Only the SHA-256 hash is stored in Postgres; raw token is shown once to the operator.
 */
export function generateIngestToken(): {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const random = crypto.randomBytes(24).toString("base64url");
  const rawToken = `vgl_ing_${random}`;
  return {
    rawToken,
    tokenHash: hashIngestToken(rawToken),
    tokenPrefix: rawToken.slice(0, 14),
  };
}

export function hashIngestToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function verifyIngestToken(
  rawToken: string,
  storedHash: string
): boolean {
  const candidate = Buffer.from(hashIngestToken(rawToken), "hex");
  const expected = Buffer.from(storedHash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // PEM private key blocks
  [
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
    "[REDACTED_PRIVATE_KEY]",
  ],
  // Authorization Bearer tokens & JWTs
  [/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1[REDACTED_TOKEN]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_JWT]"],
  // AWS access key IDs
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]"],
  // GitHub tokens
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]"],
  // Google API keys
  [/\bAIza[0-9A-Za-z\-_]{35}\b/g, "[REDACTED_GCP_KEY]"],
  // OpenAI / OpenRouter / Stripe / Render style secret keys
  [/\b(?:sk|pk|rk)_(?:live|test|or|proj)?[-_A-Za-z0-9]{16,}\b/g, "[REDACTED_API_KEY]"],
  [/\brnd_[A-Za-z0-9]{16,}\b/g, "[REDACTED_RENDER_KEY]"],
  [/\bvgl_ing_[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_INGEST_KEY]"],
  // Generic key=value / "secret": "..." patterns
  [
    /((?:password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key)\s*[:=]\s*["']?)([^"'\s,&;}]{6,})/gi,
    "$1[REDACTED]",
  ],
];

/**
 * Redacts credentials, tokens, private keys, and sensitive query/JSON parameters
 * from log lines and caps length to protect UI and LLM prompts.
 */
export function redactLogMessage(
  message: string,
  maxChars = MAX_LOG_MESSAGE_CHARS
): string {
  let clean = message;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    clean = clean.replace(pattern, replacement);
  }
  if (clean.length > maxChars) {
    return `${clean.slice(0, maxChars)}…[truncated]`;
  }
  return clean;
}
