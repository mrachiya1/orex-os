-- The original knowledge_items_ai_never_preverified CHECK constraint fires
-- on every write (insert AND update), which would make it impossible for a
-- human to ever promote an ai_extracted candidate to verified -- exactly
-- the core Company Brain workflow (prompts/003-company-brain.md section 10
-- "Facts and Inference Model": "Promotion to verified_fact is a distinct,
-- audited action... requiring knowledge.verify"). The real invariant is
-- procedural, not a standing data constraint: an INSERT may never create a
-- row with origin_type IN ('ai_extracted','system') AND
-- verification_status = 'verified' in the same write. A later UPDATE by a
-- human verifier is exactly how that candidate becomes verified. Enforced
-- going forward in application code (app/actions/knowledge.ts) instead of a
-- blanket CHECK, since Postgres CHECK constraints cannot distinguish
-- INSERT from UPDATE.

alter table knowledge_items drop constraint if exists knowledge_items_ai_never_preverified;
