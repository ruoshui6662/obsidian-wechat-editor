import { defineConfig } from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({ resolve:{alias:{obsidian:fileURLToPath(new URL('./tests/helpers/obsidian.ts',import.meta.url))}}, test: { include: ['packages/**/*.test.ts','tests/**/*.test.ts'], testTimeout: 10000, fileParallelism: false } });
