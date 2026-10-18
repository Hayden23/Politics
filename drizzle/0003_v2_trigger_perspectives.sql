-- Perspectives are part of a published version's public record too.
CREATE OR REPLACE FUNCTION story_versions_immutable_after_publish() RETURNS trigger AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND (
       NEW.headline IS DISTINCT FROM OLD.headline
    OR NEW.briefing IS DISTINCT FROM OLD.briefing
    OR NEW.key_facts IS DISTINCT FROM OLD.key_facts
    OR NEW.disputed_claims IS DISTINCT FROM OLD.disputed_claims
    OR NEW.uncertainties IS DISTINCT FROM OLD.uncertainties
    OR NEW.perspectives IS DISTINCT FROM OLD.perspectives
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
    RAISE EXCEPTION 'published story version % is immutable', OLD.id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
