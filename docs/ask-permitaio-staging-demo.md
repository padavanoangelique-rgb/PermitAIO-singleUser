# Ask PermitAIO — Staging Demo Notes (BEFORE → AFTER)

**Branch:** `feat/ask-permitaio-semantic-team`  
**Not for production.** Do not merge to main or deploy production until CoS signs off. Do not send SMS from this package.

## BEFORE (keyword short-circuit)

1. UI posts `{ bot, messages }` to `/api/chat`.
2. `searchPermitAio` ran keyword/ILIKE over libraries.
3. If keyword miss → `empty && !facts` → route **returned early** with “I don’t have that” and **skipped** specialists + desk LLM.
4. `pickSpecialists` was a regex gate (forms/code words only). No HOA Scout consult.
5. Missing model key dumped spoken/facts as the only UX.

## AFTER (semantic team, staging)

1. Route calls **`retrievePermitAio`**: structured jobs/week/scout stay exact; org corpus loads **without** keyword gate; chunks rank by OpenAI/xAI embeddings or TF-IDF cosine fallback.
2. **No empty keyword early-return.** Specialists + desk LLM always run on substantive questions.
3. `pickSpecialists(asked, desk)` always consults Investigator + Form Specialist on main/permit/corrections; HOA Scout on HOA desk or HOA/ARC mentions.
4. Missing key → clear “site model key is not set” message (spoken job facts still included when present).
5. Shop sales hot-lead language → Ricky **draft APPROVE only** instruction (no outbound wire).

## Worked example (ILLUSTRATIVE — live Supabase not hit in this PR)

**Q:** “What does Wellington usually want on window openings before we submit?”

**Corpus chunks that would rank (examples):**

- `CORRECTIONS LIBRARY` — Wellington / product approval number on opening schedule  
- `RESEARCH REPORT` — Investigator notes on opening schedule / NOA listing  
- `FORMS LIBRARY` / `BUILDING REQUIREMENT` — Wellington / Palm Beach window packet lines  
- Matched job block if a Wellington job # was in the question (always-include)

**Specialists consulted:** Investigator + Permit Form Specialist (`hoa_scout` only if HOA/ARC mentioned)

**Sample grounded answer shape:**

> Wellington has asked for the product approval (NOA) number on the opening schedule before. Put the NOA already on the job file onto the schedule. I don’t have a different “usual” ask beyond what’s in the corrections library / research FACTS. Building department has anything not on file.
