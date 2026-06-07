import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@/auth/auth.module";
import { UsersModule } from "@/users/users.module";
import { CategoriesController } from "./controllers/categories.controller";
import { TagsController } from "./controllers/tags.controller";
import { TransactionsController } from "./controllers/transactions.controller";
import { Category } from "./entities/category.entity";
import { Tag } from "./entities/tag.entity";
import { Transaction } from "./entities/transaction.entity";
import { TransactionTag } from "./entities/transaction-tag.entity";
import { CategoriesService } from "./services/categories.service";
import { TagsService } from "./services/tags.service";
import { TransactionsService } from "./services/transactions.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Category, Tag, TransactionTag]),
    AuthModule,
    UsersModule,
  ],
  controllers: [TransactionsController, CategoriesController, TagsController],
  providers: [TransactionsService, CategoriesService, TagsService],
})
export class CashflowModule {}
