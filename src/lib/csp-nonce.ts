const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let output = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;

    const triple = (a << 16) | (b << 8) | c;
    output += BASE64_ALPHABET[(triple >> 18) & 0x3f];
    output += BASE64_ALPHABET[(triple >> 12) & 0x3f];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 0x3f] : "=";
    output += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 0x3f] : "=";
  }

  return output;
}

/**
 * CSP nonce generator that is safe in both Edge and Node runtimes.
 * Avoids Node-only globals such as Buffer.
 */
export function generateCspNonce(byteLength: number = 16): string {
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new Error("invalid_nonce_length");
  }

  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}
