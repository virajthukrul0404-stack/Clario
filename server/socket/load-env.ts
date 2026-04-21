import * as nextEnv from "@next/env";

const nextEnvCompat = nextEnv as typeof nextEnv & {
  default?: {
    loadEnvConfig?: (dir: string) => void;
  };
};

nextEnvCompat.default?.loadEnvConfig?.(process.cwd());
