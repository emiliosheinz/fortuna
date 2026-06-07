import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@/auth/auth.module";
import { UsersModule } from "@/users/users.module";
import { TransactionsController } from "./controllers/transactions.controller";
import { Transaction } from "./entities/transaction.entity";
import { TransactionsService } from "./services/transactions.service";

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), AuthModule, UsersModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class CashflowModule {}
