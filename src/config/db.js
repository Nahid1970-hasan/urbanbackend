import mysql from "mysql2/promise";

/** @type {import("mysql2/promise").Pool | null} */
let pool = null;

function assertMysqlIdentifier(name, label) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(
      `Invalid ${label} "${name}": use only letters, digits, and underscores`
    );
  }
}

async function ensureDatabaseExists(config) {
  const { database, ...withoutDb } = config;
  assertMysqlIdentifier(database, "MYSQL_DATABASE");

  const admin = mysql.createPool({
    ...withoutDb,
    waitForConnections: true,
    connectionLimit: 2,
    connectTimeout: config.connectTimeout,
  });

  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await admin.end();
  }
}

async function ensureSchema(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

/** Opens pooled MySQL, creates DB/schema if missing, verifies connectivity. */
export async function connectDb() {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = Number(process.env.MYSQL_PORT) || 3306;
  const user = process.env.MYSQL_USER || "root";
  const password =
    process.env.MYSQL_PASSWORD === undefined ? "" : process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE || "urbanbackend";

  const poolConfigBase = {
    host,
    port,
    user,
    password,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 10_000,
  };

  await ensureDatabaseExists({ ...poolConfigBase, database });

  pool = mysql.createPool({
    ...poolConfigBase,
    database,
  });

  const conn = await pool.getConnection();
  try {
    await conn.ping();
    await ensureSchema(conn);
  } finally {
    conn.release();
  }

  return pool;
}

export function getPool() {
  if (!pool) {
    throw new Error("Database pool is not initialized. Call connectDb() first.");
  }
  return pool;
}
