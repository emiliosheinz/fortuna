import { Controller, Get } from "@nestjs/common";
import { MigrationsService } from "./migrations.service";

@Controller("migrations")
export class MigrationsController {
  constructor(private readonly migrationsService: MigrationsService) {}

  @Get()
  findAll() {
    return this.migrationsService.findAll();
  }
}
