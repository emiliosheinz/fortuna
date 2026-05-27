import baseConfig from "@fortuna/config/jest";
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  ...baseConfig,
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: [
    ...(baseConfig.testPathIgnorePatterns ?? []),
    "/e2e-tests/",
  ],
  moduleNameMapper: {
    ...(baseConfig.moduleNameMapper ?? {}),
    "^react-markdown$": "<rootDir>/src/test-utils/react-markdown-mock.tsx",
    "^remark-gfm$": "<rootDir>/src/test-utils/remark-gfm-mock.ts",
  },
};

export default createJestConfig(config);
