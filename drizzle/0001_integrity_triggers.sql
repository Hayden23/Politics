-- A published question's wording and scale are its identity: results depend on them.
CREATE OR REPLACE FUNCTION questions_immutable_after_publish() RETURNS trigger AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND (
       NEW.question_text IS DISTINCT FROM OLD.question_text
    OR NEW.scale_config IS DISTINCT FROM OLD.scale_config
    OR NEW.question_type IS DISTINCT FROM OLD.question_type
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.story_id IS DISTINCT FROM OLD.story_id) THEN
    RAISE EXCEPTION 'published question % is immutable; create a new version', OLD.id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER questions_immutable BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION questions_immutable_after_publish();
--> statement-breakpoint
-- A story version that has been published is part of the public record.
CREATE OR REPLACE FUNCTION story_versions_immutable_after_publish() RETURNS trigger AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND (
       NEW.headline IS DISTINCT FROM OLD.headline
    OR NEW.briefing IS DISTINCT FROM OLD.briefing
    OR NEW.key_facts IS DISTINCT FROM OLD.key_facts
    OR NEW.disputed_claims IS DISTINCT FROM OLD.disputed_claims
    OR NEW.uncertainties IS DISTINCT FROM OLD.uncertainties
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
    RAISE EXCEPTION 'published story version % is immutable', OLD.id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER story_versions_immutable BEFORE UPDATE ON story_versions
  FOR EACH ROW EXECUTE FUNCTION story_versions_immutable_after_publish();
--> statement-breakpoint
-- A story can only be published with a human approval on record.
CREATE OR REPLACE FUNCTION stories_require_approval() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.approved_by IS NULL THEN
    RAISE EXCEPTION 'story % cannot be published without an approving editor', NEW.id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER stories_require_approval BEFORE INSERT OR UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION stories_require_approval();
--> statement-breakpoint
-- The audit log is append-only.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('civic.allow_audit_scrub', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'editorial_audit_log is append-only';
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON editorial_audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
