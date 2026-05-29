-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('MEMBER', 'MASTER');

-- AlterTable: add auth columns with temporary defaults for existing rows
ALTER TABLE "TeamMember" ADD COLUMN "login_username" TEXT;
ALTER TABLE "TeamMember" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "TeamMember" ADD COLUMN "role" "MemberRole" NOT NULL DEFAULT 'MEMBER';

UPDATE "TeamMember" SET "login_username" = "name" WHERE "login_username" IS NULL;
UPDATE "TeamMember" SET "password_hash" = '' WHERE "password_hash" IS NULL;

ALTER TABLE "TeamMember" ALTER COLUMN "login_username" SET NOT NULL;
ALTER TABLE "TeamMember" ALTER COLUMN "password_hash" SET NOT NULL;

CREATE UNIQUE INDEX "TeamMember_login_username_key" ON "TeamMember"("login_username");

-- CreateTable
CREATE TABLE "MemberSession" (
    "token" TEXT NOT NULL,
    "team_member_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberSession_pkey" PRIMARY KEY ("token")
);

ALTER TABLE "MemberSession" ADD CONSTRAINT "MemberSession_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
