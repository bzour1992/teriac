import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "./schema";

// Single-source DI tokens for the DB. Imported by both db.module.ts and
// services that need the pool/drizzle instance — keep this file dependency-free
// to avoid circular-import resolution issues at NestJS boot time.
export const DRIZZLE = Symbol("DRIZZLE");
export const MYSQL_POOL = Symbol("MYSQL_POOL");

export type Db = MySql2Database<typeof schema>;
