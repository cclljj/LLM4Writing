import test from "node:test";
import assert from "node:assert/strict";
import { readSseSessionStream } from "../src/lib/sse-session-stream";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]!));
        i += 1;
      } else {
        controller.close();
      }
    }
  });
}

test("sse reader accumulates chunks and returns the final session", async () => {
  const seen: string[] = [];
  const result = await readSseSessionStream<{ id: string }>(
    streamOf([
      'data: {"type":"chunk","text":"哈"}\n\n',
      'data: {"type":"chunk","text":"囉"}\n\ndata: {"type":"done","session":{"id":"s1"}}\n\n'
    ]),
    { defaultError: "x_failed", onChunk: (t) => seen.push(t) }
  );
  assert.deepEqual(seen, ["哈", "哈囉"]);
  assert.deepEqual(result.finalSession, { id: "s1" });
  assert.equal(result.streamError, "");
});

test("sse reader surfaces error events with default fallback", async () => {
  const explicit = await readSseSessionStream(
    streamOf(['data: {"type":"error","error":"llm_timeout"}\n\n']),
    { defaultError: "x_failed", onChunk: () => undefined }
  );
  assert.equal(explicit.streamError, "llm_timeout");
  assert.equal(explicit.finalSession, null);

  const fallback = await readSseSessionStream(
    streamOf(['data: {"type":"error"}\n\n']),
    { defaultError: "x_failed", onChunk: () => undefined }
  );
  assert.equal(fallback.streamError, "x_failed");
});

test("sse reader ignores malformed lines and split-packet boundaries", async () => {
  const seen: string[] = [];
  const result = await readSseSessionStream<{ id: string }>(
    streamOf([
      "data: not-json\n\n",
      'data: {"type":"chu', // split mid-event across packets
      'nk","text":"ok"}\n\n',
      'data: {"type":"done","session":{"id":"s2"}}\n\n'
    ]),
    { defaultError: "x_failed", onChunk: (t) => seen.push(t) }
  );
  assert.deepEqual(seen, ["ok"]);
  assert.deepEqual(result.finalSession, { id: "s2" });
});

test("sse reader returns null session when stream ends without done", async () => {
  const result = await readSseSessionStream(
    streamOf(['data: {"type":"chunk","text":"partial"}\n\n']),
    { defaultError: "x_failed", onChunk: () => undefined }
  );
  assert.equal(result.finalSession, null);
  assert.equal(result.streamError, "");
});
