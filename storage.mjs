import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

process.umask(0o077);
const data = resolve(process.env.APECO_DATA_DIR || 'data');
mkdirSync(data, { recursive: true, mode: 0o700 });
const database = new DatabaseSync(resolve(data, 'eptw.sqlite'));
database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
function transaction(work) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
const migrations = new URL('./drizzle/', import.meta.url);
for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
  transaction(() => {
    if (database.prepare('SELECT 1 FROM migrations WHERE name=?').get(name)) return;
    database.exec(readFileSync(new URL(name, migrations), 'utf8'));
    database.prepare('INSERT INTO migrations VALUES (?)').run(name);
  });
}
function statement(sql, params = []) {
  const prepared = database.prepare(sql);
  return {
    bind: (...values) => statement(sql, values),
    first: () => prepared.get(...params) ?? null,
    all: () => ({ results: prepared.all(...params) }),
    run: () => ({ meta: { changes: prepared.run(...params).changes } }),
  };
}
function attachmentPath(key) {
  if (!/^permits\/[a-z0-9-]+\/[a-f0-9-]+$/i.test(key)) throw new Error('Invalid attachment key');
  return resolve(data, 'attachments', key);
}
export const env = {
  APECO_DEFAULT_ADMIN_USERNAME: process.env.APECO_ADMIN_USERNAME || 'admin',
  APECO_EMAIL_API_KEY: process.env.APECO_EMAIL_API_KEY,
  APECO_EMAIL_FROM: process.env.APECO_EMAIL_FROM,
  DB: { prepare: statement, batch: commands => transaction(() => commands.map(command => command.run())) },
  BUCKET: {
    async put(key, bytes) {
      const file = attachmentPath(key);
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
    },
    async get(key) {
      try { return { body: await readFile(attachmentPath(key)) }; }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    delete: key => rm(attachmentPath(key), { force: true }),
  },
};
