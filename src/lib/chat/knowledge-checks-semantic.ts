import { cosineSimilarity, tfidfRank, type FactChunk } from "./embeddings";
import { pickSpecialists, isTinyGreeting } from "./bots";

export type SemanticCheckFailure = { id: string; detail: string };

function fail(id: string, detail: string): SemanticCheckFailure {
  return { id, detail };
}

/** Cosine rank + pickSpecialists-always checks (no DB). */
export function runSemanticKnowledgeChecks(): SemanticCheckFailure[] {
  const failures: SemanticCheckFailure[] = [];

  if (Math.abs(cosineSimilarity([1, 0, 0], [1, 0, 0]) - 1) > 1e-6) {
    failures.push(fail("cosine-identical", "expected 1"));
  }
  if (cosineSimilarity([1, 0, 0], [0, 1, 0]) > 0.1) {
    failures.push(fail("cosine-orthogonal", "expected ~0"));
  }

  const chunks: FactChunk[] = [
    { id: "1", source: "corrections_library", text: "Wellington opening schedule NOA product approval windows" },
    { id: "2", source: "hoa_scout", text: "HOA arc paint color guidelines meeting" },
    { id: "3", source: "forms_library", text: "Broward notice of commencement routing" },
  ];
  const ranked = tfidfRank("Wellington window openings NOA", chunks);
  if (!ranked.length || ranked[0].id !== "1") {
    failures.push(fail("tfidf-top", JSON.stringify(ranked.slice(0, 2))));
  }

  if (!isTinyGreeting("hi")) {
    failures.push(fail("tiny-greeting", "hi should be tiny"));
  }

  const main = pickSpecialists(
    "What does Wellington usually want on window openings before we submit?",
    "main",
  );
  if (!main.includes("investigator") || !main.includes("forms_specialist")) {
    failures.push(fail("pick-main-always", main.join(",")));
  }
  if (main.includes("hoa_scout")) {
    failures.push(fail("pick-main-no-hoa", main.join(",")));
  }

  const hoaQ = pickSpecialists("What does the HOA association ARC usually require?", "main");
  if (!hoaQ.includes("hoa_scout")) {
    failures.push(fail("pick-hoa-mention", hoaQ.join(",")));
  }

  const hoaDesk = pickSpecialists("How long does this HOA usually take?", "hoa");
  if (!hoaDesk.includes("hoa_scout")) {
    failures.push(fail("pick-hoa-desk", hoaDesk.join(",")));
  }

  const support = pickSpecialists("The screen is blank when I click submit", "support");
  if (support.length) {
    failures.push(fail("pick-support-none", support.join(",")));
  }

  return failures;
}
