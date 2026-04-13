-- Migration 007: superadmin role
-- Apply (remote): npx wrangler d1 execute engage-db --file=migrations/007-superadmin-role.sql --remote
-- Apply (local):  npx wrangler d1 execute engage-db --file=migrations/007-superadmin-role.sql --local

-- SQLite TEXT columns have no enum constraints, so no DDL change is needed
-- to allow the new 'superadmin' value. This migration documents the change
-- and records the schema version.

-- To promote an existing admin to superadmin (run once, adjust username):
-- UPDATE users SET role = 'superadmin' WHERE username = 'amtoc';

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (7, 'superadmin role: extended permission system, audit log API (/api/admin/audit), sessions viewer API (/api/admin/sessions), permanent content delete (DELETE /api/dashboard/content/:id)');
