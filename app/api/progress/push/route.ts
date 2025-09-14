import { NextResponse } from "next/server";
import { getBus } from "@/lib/progress-bus";

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const session = String(body?.session || 'default');
    const message = typeof body?.message === 'string' ? String(body.message).trim() : '';
    const agentId = typeof body?.agentId === 'string' ? body.agentId : undefined;
    const status = typeof body?.status === 'string' ? body.status as any : undefined;
    const data = (body && typeof body.data === 'object') ? body.data : undefined;
    if (!message && !agentId) {
      return NextResponse.json({ ok: false, error: 'Empty message and no agentId' }, { status: 400 });
    }
    getBus().publish(session, { text: message || undefined, agentId, status, data, ts: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to push' }, { status: 500 });
  }
}
