import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@/auth/auth.module";
import { FxModule } from "@/fx/fx.module";
import { UsersModule } from "@/users/users.module";
import { SummaryController } from "./controllers/summary.controller";
import { TagsController } from "./controllers/tags.controller";
import { TransactionsController } from "./controllers/transactions.controller";
import { TrendController } from "./controllers/trend.controller";
import { Tag } from "./entities/tag.entity";
import { Transaction } from "./entities/transaction.entity";
import { TransactionTag } from "./entities/transaction-tag.entity";
import { SummaryService } from "./services/summary.service";
import { TagDrillDownService } from "./services/tag-drill-down.service";
import { TagsService } from "./services/tags.service";
import { TransactionsService } from "./services/transactions.service";
import { TrendService } from "./services/trend.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Tag, TransactionTag]),
    AuthModule,
    UsersModule,
    FxModule,
  ],
  controllers: [
    TransactionsController,
    TagsController,
    SummaryController,
    TrendController,
  ],
  providers: [
    TransactionsService,
    TagsService,
    SummaryService,
    TrendService,
    TagDrillDownService,
  ],
})
export class CashflowModule {}
