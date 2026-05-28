#!/usr/bin/env -S npx tsx
// Sets a known password on the staging DB's single user so we can test login.
//
// Usage:
//   pnpm --filter @teriac/api db:seed-dev-user
//
// Reads DB credentials from .env. Refuses to run if NODE_ENV=production OR if
// the target user already has a password hash set (to avoid clobbering real ones).
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { createPool } from "mysql2/promise";
import * as bcrypt from "bcrypt";

loadEnv({ path: resolve(__dirname, "../../../.env") });

const PASSWORD = process.env.DEV_USER_PASSWORD ?? "teriac-dev-2026";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run in NODE_ENV=production");
    process.exit(2);
  }

  const userId = process.env.DEV_DEFAULT_USER_ID;
  if (!userId) {
    console.error("DEV_DEFAULT_USER_ID is not set in .env");
    process.exit(2);
  }

  const pool = createPool({
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  });

  try {
    const [rows] = (await pool.query(
      "SELECT UserId, UserName, PasswordHash FROM hcenterusers WHERE UserId = ? LIMIT 1",
      [userId],
    )) as [Array<{ UserId: string; UserName: string | null; PasswordHash: string | null }>, unknown];

    const user = rows[0];
    if (!user) {
      console.error(`User ${userId} not found`);
      process.exit(2);
    }

    if (user.PasswordHash) {
      console.log(
        `User ${user.UserName} already has a PasswordHash — leaving it alone. ` +
          `Set DEV_FORCE_RESEED=1 to overwrite.`,
      );
      if (process.env.DEV_FORCE_RESEED !== "1") return;
    }

    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
    const hash = await bcrypt.hash(PASSWORD, rounds);

    await pool.query(
      "UPDATE hcenterusers SET PasswordHash = ?, PasswordChangedAt = NOW(3), IsActive = 1 WHERE UserId = ?",
      [hash, userId],
    );

    console.log("---");
    console.log("Dev user seeded successfully.");
    console.log(`  UserId:   ${user.UserId}`);
    console.log(`  UserName: ${user.UserName}`);
    console.log(`  Password: ${PASSWORD}`);
    console.log("---");
    console.log("Login example:");
    console.log(
      `  curl -X POST http://localhost:3001/v1/auth/login \\\n` +
        `    -H "Content-Type: application/json" \\\n` +
        `    -d '{"username":"${user.UserName}","password":"${PASSWORD}"}'`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
