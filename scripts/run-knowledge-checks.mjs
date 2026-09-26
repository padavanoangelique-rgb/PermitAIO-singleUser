import { register } from "node:module";

register("./ts-resolver.mjs", import.meta.url);

const { runKnowledgeChecks } = await import("../src/lib/chat/knowledge-checks.ts");
const failures = runKnowledgeChecks();
if (failures.length) {
  for (const failure of failures) console.error(`${failure.id}: ${failure.detail}`);
  console.error(`${failures.length} knowledge check(s) failed.`);
  process.exit(1);
}
console.log(`Knowledge checks passed (${new Date().toISOString()}).`);
