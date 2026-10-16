import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { closeDatabase } from './database.js';

const server = createServer(createApp());
server.listen(config.API_PORT, '127.0.0.1', () => {
  console.info(`Meld API listening on 127.0.0.1:${config.API_PORT}`);
  if (!config.SUPABASE_DATABASE_URL) console.info('Supabase Postgres is not configured. Meld profiles cannot be saved.');
});

async function shutdown(signal: string) {
  console.info(`Meld API received ${signal}; closing cleanly.`);
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
