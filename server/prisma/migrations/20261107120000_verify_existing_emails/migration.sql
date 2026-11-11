-- Accounts that existed before email verification was required stay usable.
UPDATE "user" SET "emailVerified" = true;
