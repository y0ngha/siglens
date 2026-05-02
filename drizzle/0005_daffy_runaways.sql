-- NOTE: Reverts the default established in 0004_petite_medusa.sql, which added
-- `email_verified` with `DEFAULT true NOT NULL`. Postgres `ADD COLUMN ... DEFAULT true`
-- backfills existing rows with `true`, so any users created before 0005 was applied
-- carry `email_verified = true`. This pair of migrations is preserved as historical
-- state — do not edit 0004 retroactively. If a corrective backfill is required for
-- specific cohorts, add a new forward migration rather than modifying 0004/0005.
ALTER TABLE "users" ALTER COLUMN "email_verified" SET DEFAULT false;