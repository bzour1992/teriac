import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { RequiresModule } from "../../common/modules/requires-module.decorator";
import { WalletsService } from "./wallets.service";
import { TransactionsService } from "./transactions.service";
import {
  CreateTransactionDto,
  CreateWalletDto,
  ListTransactionsQueryDto,
  TransferDto,
  UpdateTransactionDto,
  type DoctorRevenueItem,
  type PnlReport,
  type TransactionItem,
  type TransactionListResponse,
  type WalletItem,
} from "./dto/finance.dto";

@ApiTags("finance")
@ApiBearerAuth()
@RequiresModule("finance")
@Controller("finance/wallets")
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get()
  list(): Promise<WalletItem[]> {
    return this.wallets.list();
  }

  @Post()
  create(@Body() body: CreateWalletDto): Promise<{ walletId: string }> {
    return this.wallets.create(body);
  }

  @Get(":id/balance")
  getBalance(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<{ walletId: string; balance: number }> {
    return this.wallets.getBalance(id);
  }

  @Post("transfer")
  transfer(@Body() body: TransferDto): Promise<{ hcenterFinancalTransactionId: string }> {
    return this.wallets.transfer(body);
  }
}

@ApiTags("finance")
@ApiBearerAuth()
@RequiresModule("finance")
@Controller("finance/transactions")
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@Query() query: ListTransactionsQueryDto): Promise<TransactionListResponse> {
    return this.transactions.list(query);
  }

  @Post()
  create(@Body() body: CreateTransactionDto): Promise<{ hcenterFinancalTransactionId: string }> {
    return this.transactions.create(body);
  }

  @Get(":id")
  getById(@Param("id", new ParseUUIDPipe()) id: string): Promise<TransactionItem> {
    return this.transactions.getById(id);
  }

  @Put(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTransactionDto,
  ): Promise<void> {
    await this.transactions.update(id, body);
  }
}

@ApiTags("finance")
@ApiBearerAuth()
@RequiresModule("finance")
@Controller("finance/reports")
export class FinanceReportsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get("pnl")
  @ApiQuery({ name: "from", required: true })
  @ApiQuery({ name: "to", required: true })
  getPnl(
    @Query("from") from: string,
    @Query("to") to: string,
  ): Promise<PnlReport> {
    return this.transactions.getPnl(from, to);
  }

  @Get("daily")
  @ApiQuery({ name: "from", required: true })
  @ApiQuery({ name: "to", required: true })
  getDaily(
    @Query("from") from: string,
    @Query("to") to: string,
  ): Promise<import("./dto/finance.dto").DailyReport[]> {
    return this.transactions.getDaily(from, to);
  }

  @Get("by-doctor")
  @ApiQuery({ name: "from", required: true })
  @ApiQuery({ name: "to", required: true })
  getByDoctor(
    @Query("from") from: string,
    @Query("to") to: string,
  ): Promise<DoctorRevenueItem[]> {
    return this.transactions.getByDoctor(from, to);
  }
}
