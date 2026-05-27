import baseConfig from "@fortuna/config/jest";
import type { Config } from "jest";

const config: Config = {
  ...baseConfig,
  transformIgnorePatterns: [
    "/node_modules/.pnpm/(?!jose@)",
    "\\.pnp\\.[^\\/]+$",
  ],
};

export default config;
