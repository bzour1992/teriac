import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  hcenterfinancaltransactions,
  wallets,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateWalletDto, TransferDto, WalletItem } from "./dto/finance.dto";

@Injectable()
export class WalletsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<WalletItem[]> {
    const rows = await this.tdb.db
      .select()
      .from(wallets)
      .where(this.tdb.tenantClause(wallets))
      .orderBy(wallets.walletName);

    return rows.map((r) => ({
      walletId: r.walletId,
      walletName: r.walletName,
      isDefault: r.isDefault === 1,
      isSystem: r.isSystem === 1,
      isCashBox: r.isCacheBox === 1,
    }));
  }

  async getBalance(walletId: string): Promise<{ walletId: string; balance: number }> {
    const [wallet] = await this.tdb.db
      .select()
      .from(wallets)
      .where(
        and(eq(wallets.walletId, walletId), this.tdb.tenantClause(wallets)),
      )
      .limit(1);
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);

    // Income into wallet = TransactionType IN (1,3) where walletId = destination
    // Transfer in = TransactionType=4 where walletId = destination
    // Expense / salary out = TransactionType IN (2,5,6) where walletId = source
    // Transfer out = TransactionType=4 where sourceWallet = this wallet
    const [result] = await this.tdb.db
      .select({
        balance: sql<number>`
          COALESCE(SUM(
            CASE
              WHEN ${hcenterfinancaltransactions.walletId} = ${walletId}
                AND ${hcenterfinancaltransactions.transactionType} IN (1, 3, 4)
              THEN ${hcenterfinancaltransactions.amount}
              WHEN ${hcenterfinancaltransactions.walletId} = ${walletId}
                AND ${hcenterfinancaltransactions.transactionType} IN (2, 5, 6)
              THEN -${hcenterfinancaltransactions.amount}
              WHEN ${hcenterfinancaltransactions.sourceWallet} = ${walletId}
                AND ${hcenterfinancaltransactions.transactionType} = 4
              THEN -${hcenterfinancaltransactions.amount}
              ELSE 0
            END
          ), 0)`,
      })
      .from(hcenterfinancaltransactions)
      .where(eq(hcenterfinancaltransactions.hcenterId, this.tdb.tenantId));

    return { walletId, balance: Number(result?.balance ?? 0) };
  }

  async create(dto: CreateWalletDto): Promise<{ walletId: string }> {
    const id = randomUUID();
    await this.tdb.db.insert(wallets).values({
      walletId: id,
      hcenterId: this.tdb.tenantId,
      walletName: dto.walletName.trim(),
      isDefault: 0,
      isSystem: 0,
      isCacheBox: dto.isCashBox ? 1 : 0,
    });
    await this.audit.record({
      action: "Create",
      entityType: "Wallet",
      entityId: id,
      patientContext: null,
      newValues: { walletName: dto.walletName },
    });
    return { walletId: id };
  }

  async transfer(dto: TransferDto): Promise<{ hcenterFinancalTransactionId: string }> {
    if (dto.fromWalletId === dto.toWalletId) {
      throw new BadRequestException("Source and destination wallets must differ");
    }
    await this.assertWallet(dto.fromWalletId);
    await this.assertWallet(dto.toWalletId);

    const id = randomUUID();
    const now = fmtDate(new Date());

    await this.tdb.db.insert(hcenterfinancaltransactions).values({
      hcenterFinancalTransactionId: id,
      hcenterId: this.tdb.tenantId,
      details: `Transfer: ${dto.notes ?? "wallet transfer"}`,
      amount: dto.amount,
      discount: 0,
      transactionType: 4, // Transfer
      notes: dto.notes?.trim() ?? null,
      addDate: now,
      addUserId: this.tenant.userId,
      walletId: dto.toWalletId,
      sourceWallet: dto.fromWalletId,
    });

    await this.audit.record({
      action: "Create",
      entityType: "FinanceTransaction",
      entityId: id,
      patientContext: null,
      newValues: {
        type: "Transfer",
        amount: dto.amount,
        from: dto.fromWalletId,
        to: dto.toWalletId,
      },
    });
    return { hcenterFinancalTransactionId: id };
  }

  private async assertWallet(walletId: string): Promise<void> {
    const [row] = await this.tdb.db
      .select({ id: wallets.walletId })
      .from(wallets)
      .where(and(eq(wallets.walletId, walletId), this.tdb.tenantClause(wallets)))
      .limit(1);
    if (!row) throw new NotFoundException(`Wallet ${walletId} not found`);
  }
}

function fmtDate(v: Date): string {
  const yyyy = v.getUTCFullYear();
  const mm   = String(v.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(v.getUTCDate()).padStart(2, "0");
  const HH   = String(v.getUTCHours()).padStart(2, "0");
  const MM   = String(v.getUTCMinutes()).padStart(2, "0");
  const SS   = String(v.getUTCSeconds()).padStart(2, "0");
  const ms   = String(v.getUTCMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}.${ms}`;
}
