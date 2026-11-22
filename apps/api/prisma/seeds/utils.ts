import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dataDir = join(import.meta.dirname, '..', 'data');

export function readSeedJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(dataDir, file), 'utf8')) as T;
}
