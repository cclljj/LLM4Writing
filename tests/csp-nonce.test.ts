import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { generateCspNonce } from "../src/lib/csp-nonce";

test("generateCspNonce: outputs base64 nonce with expected length", () => {
  const nonce = generateCspNonce();
  assert.equal(nonce.length, 24, "16 random bytes should encode to 24 base64 chars");
  assert.match(nonce, /^[A-Za-z0-9+/]+=*$/, "nonce should contain only base64 characters");
});

test("generateCspNonce: supports custom byte length", () => {
  const nonce = generateCspNonce(18);
  assert.equal(nonce.length, 24, "18 random bytes should encode to 24 base64 chars without truncation");
  assert.match(nonce, /^[A-Za-z0-9+/]+=*$/);
});

test("generateCspNonce: rejects invalid byte length", () => {
  assert.throws(() => generateCspNonce(0), /invalid_nonce_length/);
  assert.throws(() => generateCspNonce(1.5), /invalid_nonce_length/);
});

test("proxy uses nonce helper instead of Buffer-based encoding", () => {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const proxySource = readFileSync(resolve(thisDir, "../proxy.ts"), "utf8");

  assert.ok(proxySource.includes("generateCspNonce"), "proxy should call shared nonce helper");
  assert.equal(
    proxySource.includes("Buffer.from(crypto.randomUUID()).toString(\"base64\")"),
    false,
    "proxy must not rely on Buffer in edge runtime"
  );
});
