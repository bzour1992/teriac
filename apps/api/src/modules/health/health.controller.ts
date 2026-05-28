import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { MYSQL_POOL } from "../../db/tokens";
import { Public } from "../auth/jwt.guard";

interface VersionRow extends RowDataPacket {
  version: string;
}

@Public()
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  @Get()
  liveness(): { status: "ok"; ts: string } {
    return { status: "ok", ts: new Date().toISOString() };
  }

  @Get("db")
  async db(): Promise<{ status: "ok" | "error"; version?: string; error?: string }> {
    try {
      const [rows] = await this.pool.query<VersionRow[]>("SELECT VERSION() AS version");
      return { status: "ok", version: rows[0]?.version };
    } catch (err) {
      return { status: "error", error: (err as Error).message };
    }
  }
}
