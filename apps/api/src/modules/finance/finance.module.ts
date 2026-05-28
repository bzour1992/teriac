import { Module } from "@nestjs/common";
import {
  WalletsController,
  TransactionsController,
  FinanceReportsController,
} from "./finance.controller";
import { WalletsService } from "./wallets.service";
import { TransactionsService } from "./transactions.service";

@Module({
  controllers: [WalletsController, TransactionsController, FinanceReportsController],
  providers: [WalletsService, TransactionsService],
})
export class FinanceModule {}
