/// <reference types="vite/client" />

declare module "vitest" {
  // eslint-disable-next-line typescript/no-explicit-any
  type Fn = (...args: any[]) => any;
  interface SuiteAPI {
    (name: string | Fn, fn: () => void): void;
    each(cases: readonly unknown[]): (name: string, fn: (...args: never[]) => void) => void;
  }
  interface TestAPI {
    (name: string, fn: () => void | Promise<void>): void;
    each(
      cases: readonly unknown[],
    ): (name: string, fn: (...args: never[]) => void | Promise<void>) => void;
  }
  export const describe: SuiteAPI;
  export const it: TestAPI;
  // eslint-disable-next-line typescript/no-explicit-any
  export const expect: any;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
}

declare module "@duckdb/duckdb-wasm/dist/duckdb-node-blocking" {
  import type { AsyncDuckDB, DuckDBBundles, Logger } from "@duckdb/duckdb-wasm";
  export function createDuckDB(
    bundles: DuckDBBundles,
    logger: Logger,
    runtime: unknown,
  ): Promise<AsyncDuckDB>;
  export const ConsoleLogger: new () => Logger;
  export const NODE_RUNTIME: unknown;
}
