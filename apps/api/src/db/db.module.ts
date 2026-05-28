import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";
import { DRIZZLE, MYSQL_POOL, type Db } from "./tokens";
import { TenantDbService } from "./tenant-db.service";
import { TenantContextService } from "../common/tenant/tenant-context";

export { DRIZZLE, MYSQL_POOL, type Db } from "./tokens";

@Global()
@Module({
  providers: [
    {
      provide: MYSQL_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool =>
        createPool({
          host: config.getOrThrow<string>("DB_HOST"),
          port: config.get<number>("DB_PORT", 3306),
          user: config.getOrThrow<string>("DB_USER"),
          password: config.getOrThrow<string>("DB_PASSWORD"),
          database: config.getOrThrow<string>("DB_NAME"),
          connectionLimit: config.get<number>("DB_CONNECTION_LIMIT", 10),
          timezone: "Z",
          dateStrings: false,
          supportBigNumbers: true,
          bigNumberStrings: false,
        }),
    },
    {
      provide: DRIZZLE,
      inject: [MYSQL_POOL],
      useFactory: (pool: Pool): Db => drizzle(pool, { schema, mode: "default" }),
    },
    TenantContextService,
    TenantDbService,
  ],
  exports: [DRIZZLE, MYSQL_POOL, TenantContextService, TenantDbService],
})
export class DbModule {}
