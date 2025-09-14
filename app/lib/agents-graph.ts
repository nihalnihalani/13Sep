// Centralized agent graph model wrapping existing API routes

export type AgentNode = {
  id: string;
  name: string;
  path: string;
  methods: ("GET" | "POST" | "DELETE")[];
  description?: string;
  group: "orchestration" | "analysis" | "generation" | "media" | "progress";
  env?: string[];
};

export type AgentEdge = {
  from: string;
  to: string;
  label?: string;
  optional?: boolean;
};

export type AgentGraph = {
  nodes: AgentNode[];
  edges: AgentEdge[];
};

// Nodes derived from existing routes under app/api
const nodes: AgentNode[] = [
  {
    id: "voice.run",
    name: "Voice Run",
    path: "/api/voice/run",
    methods: ["POST"],
    description: "Orchestrates full campaign: analyze image, cultural cues, image+video generation.",
    group: "orchestration",
    env: ["NEXT_PUBLIC_BASE_URL"],
  },
  {
    id: "demographics.expand",
    name: "Demographics Expand",
    path: "/api/demographics/expand",
    methods: ["POST"],
    description: "Expands raw plan text to structured demographics (LLM or heuristic).",
    group: "analysis",
    env: ["OPENAI_API_KEY", "OPENAI_MODEL"],
  },
  {
    id: "cultural.intelligence",
    name: "Cultural Intelligence",
    path: "/api/cultural/intelligence",
    methods: ["POST"],
    description: "Generates cultural insights using Qloo + LLM fallback.",
    group: "analysis",
    env: ["OPENAI_API_KEY", "OPENAI_MODEL"],
  },
  {
    id: "vision.analyze",
    name: "Vision Analyze",
    path: "/api/vision/analyze",
    methods: ["POST"],
    description: "Extracts structured insights from an image (OpenAI Vision).",
    group: "analysis",
    env: ["OPENAI_API_KEY", "OPENAI_VISION_MODEL"],
  },
  {
    id: "imagen.generate",
    name: "Imagen Generate",
    path: "/api/imagen/generate",
    methods: ["POST"],
    description: "Generates an image via Imagen; persists to Neo4j and serves via media/file.",
    group: "generation",
    env: ["GEMINI_API_KEY", "NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"],
  },
  {
    id: "gemini.generate",
    name: "Gemini Generate",
    path: "/api/gemini/generate",
    methods: ["POST"],
    description: "Generates image via Gemini; falls back to Imagen; persists to Neo4j.",
    group: "generation",
    env: ["GEMINI_API_KEY", "NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"],
  },
  {
    id: "gemini.edit",
    name: "Gemini Edit",
    path: "/api/gemini/edit",
    methods: ["POST"],
    description: "Edits images via Gemini (multipart); persists to Neo4j.",
    group: "generation",
    env: ["GEMINI_API_KEY", "NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"],
  },
  {
    id: "veo.generate",
    name: "Veo Generate",
    path: "/api/veo/generate",
    methods: ["POST"],
    description: "Starts a video generation operation (Veo).",
    group: "generation",
    env: ["GEMINI_API_KEY"],
  },
  {
    id: "veo.operation",
    name: "Veo Operation",
    path: "/api/veo/operation",
    methods: ["POST"],
    description: "Polls a Veo operation for completion and collects URIs.",
    group: "generation",
    env: ["GEMINI_API_KEY"],
  },
  {
    id: "veo.download",
    name: "Veo Download",
    path: "/api/veo/download",
    methods: ["POST"],
    description: "Downloads/streams generated video; optionally saves to Neo4j & disk.",
    group: "generation",
    env: ["GEMINI_API_KEY", "NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"],
  },
  {
    id: "media.index",
    name: "Media Index",
    path: "/api/media",
    methods: ["GET", "POST", "DELETE"],
    description: "CRUD for Media nodes in Neo4j (images/videos/tags).",
    group: "media",
    env: ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"],
  },
  {
    id: "media.file",
    name: "Media File",
    path: "/api/media/file",
    methods: ["GET"],
    description: "Streams bytes for image media by id; redirects videos to saved URL.",
    group: "media",
    env: ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"],
  },
  {
    id: "progress.sse",
    name: "Progress SSE",
    path: "/api/progress",
    methods: ["GET"],
    description: "Server-sent events stream for long-running tasks.",
    group: "progress",
  },
  {
    id: "progress.push",
    name: "Progress Push",
    path: "/api/progress/push",
    methods: ["POST"],
    description: "Pushes progress messages to SSE clients via in-memory bus.",
    group: "progress",
  },
];

// Key orchestration and data flow edges
const edges: AgentEdge[] = [
  { from: "voice.run", to: "vision.analyze", label: "analyze image", optional: true },
  { from: "voice.run", to: "cultural.intelligence", label: "cultural cues" },
  { from: "voice.run", to: "imagen.generate", label: "generate image" },
  { from: "voice.run", to: "veo.generate", label: "generate video" },
  { from: "veo.generate", to: "veo.operation", label: "poll" },
  { from: "veo.operation", to: "veo.download", label: "download/save" },

  { from: "gemini.generate", to: "media.file", label: "serve image" },
  { from: "gemini.edit", to: "media.file", label: "serve image" },
  { from: "imagen.generate", to: "media.file", label: "serve image" },

  { from: "voice.run", to: "progress.push", label: "status events" },
  // Clients consume progress.sse separately
];

export function getAgentGraph(): AgentGraph {
  return { nodes, edges };
}

export function getAgentList(): AgentNode[] {
  return nodes.slice();
}


