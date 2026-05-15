import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

export interface Migration {
  id: number;
  timestamp: string;
  name: string;
}

@Injectable()
export class MigrationsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  findAll(): Promise<Migration[]> {
    return this.dataSource.query<Migration[]>(
      "SELECT * FROM migrations ORDER BY timestamp",
    );
  }
}
