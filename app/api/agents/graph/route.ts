import { NextResponse } from "next/server";
import { getAgentGraph } from "@/lib/agents-graph";

export const runtime = "nodejs";

export async function GET() {
  try {
    const graph = getAgentGraph();
    return NextResponse.json(graph);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to get graph" }, { status: 500 });
  }
}


