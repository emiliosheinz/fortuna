import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "./app.module";

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
    }).compile();

    expect(module).toBeDefined();
  });
});
