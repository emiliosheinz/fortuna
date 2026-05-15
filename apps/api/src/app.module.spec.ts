import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { MigrationsService } from "./migrations/migrations.service";

jest.mock("@nestjs/typeorm", () => ({
  TypeOrmModule: {
    forRootAsync: jest.fn().mockReturnValue({
      module: class MockTypeOrmRootModule {},
      providers: [],
      exports: [],
      global: true,
    }),
  },
  InjectDataSource: jest.fn(() => () => {}),
}));

describe("AppModule", () => {
  it("compiles without a real database connection", async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MigrationsService)
      .useValue({ findAll: jest.fn() })
      .compile();

    expect(module).toBeDefined();
  });
});
