import { resolve } from 'node:path';
import { DEFAULT_SERVER_PORT } from '@slatra/shared';

export interface ServerConfig {
  port: number;
  clientOrigin: string;
  persistenceFilePath: string;
}

export function getServerConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? DEFAULT_SERVER_PORT),
    clientOrigin: process.env.CLIENT_ORIGIN ?? '*',
    persistenceFilePath: resolve(process.cwd(), process.env.PERSISTENCE_FILE ?? '.data/slatra-server-state.json'),
  };
}
