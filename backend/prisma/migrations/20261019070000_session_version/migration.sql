-- Revoke previously issued JWTs after a user's password is changed.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
