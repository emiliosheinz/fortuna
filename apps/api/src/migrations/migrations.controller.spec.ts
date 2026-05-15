import { Test, TestingModule } from "@nestjs/testing";
import { MigrationsController } from "./migrations.controller";
import { MigrationsService } from "./migrations.service";

const mockMigrations = [
  { id: 1, timestamp: "1747094400000", name: "InitialBaseline1747094400000" },
];

const mockMigrationsService = { findAll: jest.fn() };

describe("MigrationsController", () => {
  let controller: MigrationsController;

  beforeEach(async () => {
    mockMigrationsService.findAll.mockResolvedValue(mockMigrations);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MigrationsController],
      providers: [
        { provide: MigrationsService, useValue: mockMigrationsService },
      ],
    }).compile();

    controller = module.get<MigrationsController>(MigrationsController);
  });

  it("returns migrations from the service", async () => {
    const result = await controller.findAll();
    expect(result).toEqual(mockMigrations);
  });
});
