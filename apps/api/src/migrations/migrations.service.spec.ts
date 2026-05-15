import { Test, TestingModule } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import { MigrationsService } from "./migrations.service";

const mockMigrations = [
  { id: 1, timestamp: "1747094400000", name: "InitialBaseline1747094400000" },
];

const mockDataSource = { query: jest.fn() };

describe("MigrationsService", () => {
  let service: MigrationsService;

  beforeEach(async () => {
    mockDataSource.query.mockResolvedValue(mockMigrations);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationsService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<MigrationsService>(MigrationsService);
  });

  it("queries migrations ordered by timestamp", async () => {
    const result = await service.findAll();

    expect(mockDataSource.query).toHaveBeenCalledWith(
      "SELECT * FROM migrations ORDER BY timestamp",
    );
    expect(result).toEqual(mockMigrations);
  });
});
