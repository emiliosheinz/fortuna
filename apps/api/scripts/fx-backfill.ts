import { NestFactory } from "@nestjs/core";
import { AppModule } from "@/app.module";
import { FxFetchService } from "@/fx/services/fx-fetch.service";

interface BackfillArgs {
  from: string;
  to: string;
}

function parseArgs(argv: string[]): BackfillArgs {
  const args: Partial<BackfillArgs> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--from" || arg === "-f") {
      args.from = argv[++i];
    } else if (arg === "--to" || arg === "-t") {
      args.to = argv[++i];
    }
  }
  if (!args.from || !args.to) {
    throw new Error("usage: fx-backfill --from YYYY-MM-DD --to YYYY-MM-DD");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(args.from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(args.to)
  ) {
    throw new Error("expected ISO dates (YYYY-MM-DD) for --from and --to");
  }
  return args as BackfillArgs;
}

async function main(): Promise<void> {
  const { from, to } = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });
  try {
    const fetcher = app.get(FxFetchService);
    const persisted = await fetcher.fetchAndPersistRange(from, to);
    console.log(
      `Backfill persisted ${persisted} EUR-anchored rate row(s) from ${from} to ${to}.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error("fx-backfill failed:", error);
  process.exit(1);
});
