import { getPool } from "../config/db.js";

export async function findAllItems() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, created_at AS createdAt, updated_at AS updatedAt
     FROM items
     ORDER BY created_at DESC`
  );
  return rows;
}

export async function createItem({ name }) {
  const pool = getPool();
  const [result] = await pool.query(`INSERT INTO items (name) VALUES (?)`, [
    name,
  ]);
  const insertId = result.insertId;

  const [rows] = await pool.query(
    `SELECT id, name, created_at AS createdAt, updated_at AS updatedAt
     FROM items
     WHERE id = ?`,
    [insertId]
  );
  return rows[0];
}
