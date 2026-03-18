import { DEFAULT_SERVER_PORT } from '@slatra/shared';

export interface ServerConfig {
  port: number;
  clientOrigin: string;
}

export function getServerConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? DEFAULT_SERVER_PORT),
    clientOrigin: process.env.CLIENT_ORIGIN ?? '*',
  };
}
