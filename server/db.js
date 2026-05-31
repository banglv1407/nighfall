import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'nightfall.db');
let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      gender TEXT DEFAULT 'male',
      hair_style TEXT DEFAULT 'short',
      hair_color TEXT DEFAULT '#1a1a1a',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed admin if not exists
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, 1)'
    ).run('admin', 'admin@nightfall.game', hash);
    console.log('✅ Admin account created (admin / admin123)');
  }
}

export const HAIR_STYLES = [
  { id: 'short',    label: 'Tóc Ngắn',  emoji: '💇' },
  { id: 'long',     label: 'Tóc Dài',   emoji: '💁' },
  { id: 'ponytail', label: 'Tóc Đuôi Ngựa', emoji: '🎀' },
  { id: 'curly',    label: 'Tóc Xoăn',  emoji: '🦱' },
  { id: 'bun',      label: 'Tóc Búi',   emoji: '🍩' },
  { id: 'bald',     label: 'Hói',       emoji: '🪩' },
  { id: 'mohawk',   label: 'Mohawk',    emoji: '🦖' },
  { id: 'wavy',     label: 'Tóc Gợn Sóng', emoji: '🌊' },
];

export const HAIR_COLORS = [
  { id: '#1a1a1a', label: 'Đen',       emoji: '⚫' },
  { id: '#8B4513', label: 'Nâu',       emoji: '🟤' },
  { id: '#FFD700', label: 'Vàng',      emoji: '🟡' },
  { id: '#DC143C', label: 'Đỏ',        emoji: '🔴' },
  { id: '#C0C0C0', label: 'Bạc',       emoji: '⬜' },
  { id: '#4169E1', label: 'Xanh Dương', emoji: '🔵' },
  { id: '#FF69B4', label: 'Hồng',      emoji: '🩷' },
  { id: '#7B68EE', label: 'Tím',       emoji: '🟣' },
];

export function createUser(username, email, passwordHash, { gender, hairStyle, hairColor }) {
  const db = getDb();
  try {
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, gender, hair_style, hair_color) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(username, email || null, passwordHash, gender, hairStyle, hairColor);
    return result.lastInsertRowid;
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      throw new Error('Username already taken');
    }
    throw e;
  }
}

export function getUserByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserById(id) {
  const db = getDb();
  return db.prepare(
    'SELECT id, username, email, is_admin, gender, hair_style, hair_color, created_at FROM users WHERE id = ?'
  ).get(id);
}

export function getAllUsers() {
  const db = getDb();
  return db.prepare(
    'SELECT id, username, is_admin, gender, hair_style, hair_color FROM users ORDER BY username'
  ).all();
}
