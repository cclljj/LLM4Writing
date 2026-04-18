import { SessionState } from "@/src/lib/types";

type MemoryStore = Map<string, SessionState>;

const KEY = "__llm4writing_sessions__";

function getStore(): MemoryStore {
  const globalScope = globalThis as unknown as Record<string, MemoryStore | undefined>;
  if (!globalScope[KEY]) {
    globalScope[KEY] = new Map<string, SessionState>();
  }
  return globalScope[KEY] as MemoryStore;
}

export function saveSession(session: SessionState): SessionState {
  const store = getStore();
  store.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): SessionState | undefined {
  return getStore().get(sessionId);
}
