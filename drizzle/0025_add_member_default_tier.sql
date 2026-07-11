ALTER TABLE "users" ALTER COLUMN "tier" SET DEFAULT 'member';--> statement-breakpoint
UPDATE "users" SET "tier" = 'member' WHERE "tier" = 'free';