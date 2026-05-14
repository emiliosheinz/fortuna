import { AppDataSource } from "../src/data-source";

AppDataSource.initialize()
  .then((dataSource) => dataSource.runMigrations())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
