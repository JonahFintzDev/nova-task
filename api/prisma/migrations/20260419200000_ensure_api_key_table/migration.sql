-- Idempotent: creates the ApiKey table only if it doesn't already exist.
-- This corrects cases where the previous migration was recorded as applied
-- in _prisma_migrations but the DDL never actually executed.

CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id"         TEXT         NOT NULL,
    "userId"     TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "keyHash"    TEXT         NOT NULL,
    "keyPrefix"  TEXT         NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey"("userId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_userId_fkey'
  ) THEN
    ALTER TABLE "ApiKey"
      ADD CONSTRAINT "ApiKey_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
