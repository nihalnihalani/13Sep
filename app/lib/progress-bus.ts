// Simple in-memory progress event bus keyed by session id
// Uses globalThis to persist across hot reloads in Next.js dev.

export type ProgressMessage = {
  text?: string;
  ts?: number;
  agentId?: string; // optional structured node id (e.g., "imagen.generate")
  status?: "start" | "success" | "error" | "info"; // optional status
  data?: Record<string, any>; // optional payload
};

type Subscriber = {
  session: string;
  send: (msg: ProgressMessage) => void;
  close?: () => void;
};

type Bus = {
  subscribe: (session: string, sub: Subscriber) => () => void;
  publish: (session: string, msg: ProgressMessage) => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __PROGRESS_BUS__: Map<string, Set<Subscriber>> | undefined;
}

function getStore() {
  if (!globalThis.__PROGRESS_BUS__) {
    globalThis.__PROGRESS_BUS__ = new Map();
  }
  return globalThis.__PROGRESS_BUS__;
}

export function getBus(): Bus {
  const store = getStore();
  return {
    subscribe(session, sub) {
      if (!store.has(session)) store.set(session, new Set());
      const set = store.get(session)!;
      set.add(sub);
      return () => {
        try {
          set.delete(sub);
        } catch {}
      };
    },
    publish(session, msg) {
      const set = store.get(session);
      if (!set) return;
      const payload: ProgressMessage = { ...msg, ts: msg.ts ?? Date.now() };
      for (const sub of set) {
        try {
          sub.send(payload);
        } catch {
          // remove broken subscribers
          try { set.delete(sub); } catch {}
        }
      }
    },
  };
}
