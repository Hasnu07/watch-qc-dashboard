-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MemberRole" AS ENUM ('MEMBER', 'MASTER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: nullable first so existing rows are safe; seed backfills values
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "login_username" TEXT;
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "role" "MemberRole" NOT NULL DEFAULT 'MEMBER';

UPDATE "TeamMember" SET "login_username" = "name" WHERE "login_username" IS NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemberSession" (
    "token" TEXT NOT NULL,
    "team_member_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberSession_pkey" PRIMARY KEY ("token")
);

DO $$ BEGIN
  ALTER TABLE "MemberSession" ADD CONSTRAINT "MemberSession_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
