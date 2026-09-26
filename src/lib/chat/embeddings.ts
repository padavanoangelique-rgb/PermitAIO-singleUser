/**
 * Semantic ranking for Ask PermitAIO FACTS.
 *
 * Path selection (first match wins):
 * 1. OPENAI_API_KEY → OpenAI text-embedding-3-small
 * 2. XAI_API_KEY only → try https://api.x.ai/v1/embeddings (model: text-embedding-3-small)
 * 3. Neither / API failure → local TF-IDF token cosine (staging still works)
 */

export type EmbeddingPath = "openai" | "xai" | "tfidf";

export type EmbedBatchResult = {
  vectors: number[][];
  path: EmbeddingPath;
  note: string;
};

export type FactChunk = {
  id: string;
  source: string;
  text: string;
  /** When true, always keep in FACTS (matched jobs, spoken, week blocks). */
  alwaysInclude?: boolean;
};

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9#.\-\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Local TF-IDF vectors + cosine — used when no embedding API key works. */
export function tfidfRank(query: string, chunks: FactChunk[]): { id: string; score: number }[] {
  const docs = chunks.map((c) => tokenize(c.text));
  const qTokens = tokenize(query);
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const t of new Set(doc)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = Math.max(docs.length, 1);
  function vector(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const len = Math.max(tokens.length, 1);
    const out = new Map<string, number>();
    for (const [t, c] of tf) {
      const idf = Math.log((N + 1) / ((df.get(t) ?? 0) + 1)) + 1;
      out.set(t, (c / len) * idf);
    }
    return out;
  }
  function cosMaps(a: Map<string, number>, b: Map<string, number>) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (const v of a.values()) na += v * v;
    for (const v of b.values()) nb += v * v;
    for (const [k, v] of a) {
      const w = b.get(k);
      if (w != null) dot += v * w;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }
  const qv = vector(qTokens);
  return chunks.map((c, i) => ({ id: c.id, score: cosMaps(qv, vector(docs[i])) }));
}

async function embedOpenAi(texts: string[], key: string): Promise<number[][] | null> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { embedding?: number[]; index?: number }[] };
  if (!data.data?.length) return null;
  const sorted = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((d) => d.embedding ?? []);
}

async function embedXai(texts: string[], key: string): Promise<number[][] | null> {
  const res = await fetch("https://api.x.ai/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { embedding?: number[]; index?: number }[] };
  if (!data.data?.length) return null;
  const sorted = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((d) => d.embedding ?? []);
}

export async function embedTexts(texts: string[]): Promise<EmbedBatchResult> {
  const openai = process.env.OPENAI_API_KEY;
  const xai = process.env.XAI_API_KEY;
  if (openai) {
    const vectors = await embedOpenAi(texts, openai);
    if (vectors && vectors.length === texts.length) {
      return { vectors, path: "openai", note: "openai text-embedding-3-small" };
    }
  }
  if (xai && !openai) {
    const vectors = await embedXai(texts, xai);
    if (vectors && vectors.length === texts.length) {
      return { vectors, path: "xai", note: "xai /v1/embeddings text-embedding-3-small" };
    }
  }
  return {
    vectors: [],
    path: "tfidf",
    note: openai || xai
      ? "embedding API failed — TF-IDF token cosine fallback"
      : "no OPENAI_API_KEY / usable XAI embeddings — TF-IDF token cosine",
  };
}

export async function rankFactChunks(
  query: string,
  chunks: FactChunk[],
  topK = 16,
): Promise<{ ranked: FactChunk[]; path: EmbeddingPath; note: string }> {
  if (!chunks.length) return { ranked: [], path: "tfidf", note: "empty corpus" };

  const always = chunks.filter((c) => c.alwaysInclude);
  const candidates = chunks.filter((c) => !c.alwaysInclude);
  if (!candidates.length) {
    return { ranked: always, path: "tfidf", note: "jobs/spoken only — no library corpus" };
  }

  const batch = await embedTexts([query, ...candidates.map((c) => c.text.slice(0, 2000))]);
  let scored: { chunk: FactChunk; score: number }[];

  if (batch.path !== "tfidf" && batch.vectors.length === candidates.length + 1) {
    const qv = batch.vectors[0];
    scored = candidates.map((chunk, i) => ({
      chunk,
      score: cosineSimilarity(qv, batch.vectors[i + 1]),
    }));
  } else {
    const ranks = tfidfRank(query, candidates);
    const byId = new Map(ranks.map((r) => [r.id, r.score]));
    scored = candidates.map((chunk) => ({ chunk, score: byId.get(chunk.id) ?? 0 }));
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK).map((s) => s.chunk);
  const seen = new Set(always.map((c) => c.id));
  const merged = [...always];
  for (const c of top) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push(c);
  }
  return { ranked: merged, path: batch.path, note: batch.note };
}
