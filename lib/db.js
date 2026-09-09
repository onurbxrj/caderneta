import { createClient } from "@libsql/client";

let cliente = null;
let migrado = false;

export function db() {
  if (!cliente) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error("TURSO_DATABASE_URL não configurada");
    cliente = createClient({ url, authToken });
  }
  return cliente;
}

const TABELAS = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     nome TEXT,
     senha_hash TEXT NOT NULL,
     criado_em INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     criado_em INTEGER NOT NULL,
     expira_em INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS invites (
     codigo TEXT PRIMARY KEY,
     criado_por TEXT NOT NULL,
     criado_em INTEGER NOT NULL,
     expira_em INTEGER,
     usado_por TEXT,
     usado_em INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS vehicles (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     nome TEXT NOT NULL,
     marca TEXT, modelo TEXT, ano TEXT, placa TEXT, cor TEXT, combustivel TEXT,
     km_atual INTEGER DEFAULT 0,
     km_inicial INTEGER,
     criado_em INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id)`,
  `CREATE TABLE IF NOT EXISTS maintenances (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     vehicle_id TEXT NOT NULL,
     data TEXT NOT NULL,
     km INTEGER NOT NULL,
     categoria TEXT NOT NULL,
     servico TEXT NOT NULL,
     peca TEXT, marca_peca TEXT,
     valor_peca REAL DEFAULT 0,
     valor_mao_obra REAL DEFAULT 0,
     valor_total REAL DEFAULT 0,
     executado_por TEXT,
     proxima_km INTEGER,
     proxima_data TEXT,
     comprovante TEXT,
     observacoes TEXT,
     foto_url TEXT,
     criado_em INTEGER NOT NULL,
     atualizado_em INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_maint_user ON maintenances(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_maint_veh ON maintenances(user_id, vehicle_id)`
];

/** Cria as tabelas na primeira chamada de cada instância da função. */
export async function migrar() {
  if (migrado) return;
  for (const sql of TABELAS) await db().execute(sql);
  migrado = true;
}

export async function consultar(sql, args = []) {
  await migrar();
  const r = await db().execute({ sql, args });
  return r.rows.map((linha) => ({ ...linha }));
}

export async function executar(sql, args = []) {
  await migrar();
  return db().execute({ sql, args });
}

export async function umaLinha(sql, args = []) {
  const linhas = await consultar(sql, args);
  return linhas[0] || null;
}
