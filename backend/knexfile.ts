import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_mgt',
      multipleStatements: true,
    },
    pool: { min: 2, max: 10 },
    migrations: {
      directory: path.join(__dirname, '../database/migrations'),
      extension: 'ts',
    },
    seeds: {
      directory: path.join(__dirname, '../database/seeds'),
      extension: 'ts',
    },
  },
};

export default config;
module.exports = config;
