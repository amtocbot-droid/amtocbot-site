-- Migration 009: Media Studio — extend production_pipeline with output fields
-- Apply: npx wrangler d1 execute engage-db --remote --file=migrations/009-media-studio.sql

ALTER TABLE production_pipeline ADD COLUMN script_file TEXT;
ALTER TABLE production_pipeline ADD COLUMN audio_dir  TEXT;
ALTER TABLE production_pipeline ADD COLUMN output_file TEXT;
ALTER TABLE production_pipeline ADD COLUMN youtube_url TEXT;
ALTER TABLE production_pipeline ADD COLUMN item_type   TEXT DEFAULT 'short';

-- Extend valid stages for media production
-- scripted → narrating → narrated → assembling → assembled → uploading → uploaded → published

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (9, 'Media Studio: extend production_pipeline with output tracking fields');
