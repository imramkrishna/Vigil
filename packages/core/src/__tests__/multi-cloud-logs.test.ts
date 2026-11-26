import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  assertSafeExternalUrl,
  buildGcpLoggingFilter,
  decryptSecret,
  encryptSecret,
  formatGcpLogEntry,
  generateIngestToken,
  isBlockedIp,
  redactLogMessage,
  SsrfBlockedError,
  toPublicIntegration,
  verifyIngestToken,
} from "../index";

describe("Spec 12: Security — AES-256-GCM Crypto & Ingest Tokens", () => {
  const hexKey = crypto.randomBytes(32).toString("hex");
  const base64Key = crypto.randomBytes(32).toString("base64");

  it("encrypts and decrypts secrets cleanly with hex and base64 32-byte keys", () => {
    const sample = JSON.stringify({
      type: "service_account",
      private_key: "secret-value-123",
    });

    const encHex = encryptSecret(sample, hexKey);
    assert.equal(encHex.keyVersion, 1);
    assert.equal(encHex.ciphertext.split(":").length, 3);
    assert.notEqual(encHex.ciphertext, sample);
    assert.equal(decryptSecret(encHex.ciphertext, hexKey), sample);

    const encB64 = encryptSecret(sample, base64Key);
    assert.equal(decryptSecret(encB64.ciphertext, base64Key), sample);
  });

  it("detects ciphertext tampering via GCM auth tag", () => {
    const { ciphertext } = encryptSecret("top-secret-token", hexKey);
    const parts = ciphertext.split(":");
    const tampered = `${parts[0]}:${parts[1]}:${Buffer.from("tampered").toString("base64")}`;
    assert.throws(() => decryptSecret(tampered, hexKey));
  });

  it("fails fast when CREDENTIALS_ENCRYPTION_KEY is missing or invalid", () => {
    const prev = process.env.CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    try {
      assert.throws(
        () => encryptSecret("secret"),
        /CREDENTIALS_ENCRYPTION_KEY is required/
      );
      assert.throws(
        () => encryptSecret("secret", "short-key"),
        /32 bytes/
      );
    } finally {
      if (prev !== undefined) process.env.CREDENTIALS_ENCRYPTION_KEY = prev;
    }
  });

  it("generates and verifies SHA-256 hashed VPS ingest tokens", () => {
    const { rawToken, tokenHash, tokenPrefix } = generateIngestToken();
    assert.ok(rawToken.startsWith("vgl_ing_"));
    assert.equal(tokenPrefix, rawToken.slice(0, 14));
    assert.equal(tokenHash.length, 64);
    assert.equal(verifyIngestToken(rawToken, tokenHash), true);
    assert.equal(verifyIngestToken(`${rawToken}x`, tokenHash), false);
  });
});

describe("Spec 12: Security — Secret Redaction & Masking", () => {
  it("redacts Bearer tokens, AWS keys, GitHub PATs, and caps length", () => {
    const raw =
      "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTYifQ.abcDEF123456 " +
      "aws=AKIAIOSFODNN7EXAMPLE gh=ghp_1234567890abcdefghij1234567890 password=supersecretvalue";
    const clean = redactLogMessage(raw);
    assert.ok(!clean.includes("AKIAIOSFODNN7EXAMPLE"));
    assert.ok(!clean.includes("ghp_1234567890abcdefghij1234567890"));
    assert.ok(!clean.includes("supersecretvalue"));
    assert.ok(clean.includes("[REDACTED"));

    const longLine = "a".repeat(5000);
    const capped = redactLogMessage(longLine);
    assert.ok(capped.length <= 4020);
    assert.ok(capped.endsWith("…[truncated]"));
  });

  it("strips encryptedSecret from public integration DTOs", () => {
    const pub = toPublicIntegration({
      id: "11111111-1111-1111-1111-111111111111",
      orgId: "22222222-2222-2222-2222-222222222222",
      provider: "render",
      name: "Render Prod",
      authMethod: "api_key",
      publicConfig: { ownerId: "tea-123" },
      encryptedSecret: "iv:tag:ciphertext",
      keyVersion: 1,
      status: "connected",
      lastVerifiedAt: new Date(),
      lastError: null,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assert.equal("encryptedSecret" in pub, false);
    assert.equal(pub.name, "Render Prod");
  });
});

describe("Spec 12: Security — SSRF Protection", () => {
  it("blocks loopback, RFC-1918 private, and cloud metadata IPs", () => {
    assert.equal(isBlockedIp("127.0.0.1"), true);
    assert.equal(isBlockedIp("10.0.0.5"), true);
    assert.equal(isBlockedIp("172.16.0.1"), true);
    assert.equal(isBlockedIp("192.168.1.10"), true);
    assert.equal(isBlockedIp("169.254.169.254"), true);
    assert.equal(isBlockedIp("::1"), true);
    assert.equal(isBlockedIp("::ffff:169.254.169.254"), true);
    assert.equal(isBlockedIp("8.8.8.8"), false);
  });

  it("rejects internal/metadata URLs and non-HTTP protocols", async () => {
    await assert.rejects(
      () => assertSafeExternalUrl("http://169.254.169.254/latest/meta-data/"),
      SsrfBlockedError
    );
    await assert.rejects(
      () => assertSafeExternalUrl("http://127.0.0.1:4000/api/me"),
      SsrfBlockedError
    );
    await assert.rejects(
      () => assertSafeExternalUrl("http://metadata.google.internal/computeMetadata/v1/"),
      SsrfBlockedError
    );
    await assert.rejects(
      () => assertSafeExternalUrl("file:///etc/passwd"),
      SsrfBlockedError
    );

    const safe = await assertSafeExternalUrl("https://logs.example.com/v1/tail", {
      skipDnsLookup: true,
    });
    assert.equal(safe.hostname, "logs.example.com");
  });
});

describe("Spec 12: GCP Adapter — httpRequest Parsing & Filter Construction", () => {
  it("formats Cloud Run 5xx httpRequest entries with empty textPayload/jsonPayload", () => {
    const entry = formatGcpLogEntry(
      {
        insertId: "abc-502",
        timestamp: "2026-11-26T10:00:00Z",
        severity: "DEFAULT",
        httpRequest: {
          requestMethod: "POST",
          requestUrl: "https://api.example.com/v1/charge",
          status: 502,
          latency: "2.410s",
        },
        trace: "projects/demo/traces/4a9f81bc",
      },
      "checkout-api",
      "cloud_run"
    );

    assert.equal(entry.level, "error");
    assert.equal(
      entry.message,
      "HTTP 502 POST https://api.example.com/v1/charge (2.410s)"
    );
    assert.equal(entry.traceId, "projects/demo/traces/4a9f81bc");
  });

  it("builds exact timestamp + region/zone filters for Cloud Run and GCP VM", () => {
    const startMs = Date.parse("2026-11-26T09:00:00.000Z");
    const endMs = Date.parse("2026-11-26T09:15:00.000Z");

    const runFilter = buildGcpLoggingFilter({
      platform: "cloud_run",
      serviceName: "checkout-api",
      config: {
        projectId: "my-proj",
        serviceName: "checkout-api",
        region: "us-central1",
        instanceName: "",
        instanceId: "",
        zone: "",
        logName: "",
      },
      startTimeMs: startMs,
      endTimeMs: endMs,
      level: "error",
      keyword: "timeout",
    });

    assert.ok(runFilter.includes('resource.type="cloud_run_revision"'));
    assert.ok(runFilter.includes('resource.labels.service_name="checkout-api"'));
    assert.ok(runFilter.includes('resource.labels.location="us-central1"'));
    assert.ok(runFilter.includes('timestamp>="2026-11-26T09:00:00.000Z"'));
    assert.ok(runFilter.includes('timestamp<="2026-11-26T09:15:00.000Z"'));
    assert.ok(runFilter.includes("severity>=ERROR"));

    const vmFilter = buildGcpLoggingFilter({
      platform: "gcp_vm",
      serviceName: "api-vm-01",
      config: {
        projectId: "my-proj",
        serviceName: "",
        region: "",
        instanceName: "api-vm-01",
        instanceId: "",
        zone: "us-central1-a",
        logName: "syslog",
      },
      startTimeMs: startMs,
      endTimeMs: endMs,
    });

    assert.ok(vmFilter.includes('resource.type="gce_instance"'));
    assert.ok(vmFilter.includes('resource.labels.zone="us-central1-a"'));
    assert.ok(vmFilter.includes('logName:"syslog"'));
  });
});
