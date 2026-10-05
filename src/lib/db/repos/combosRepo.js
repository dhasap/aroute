import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function rowToCombo(row) {
  if (!row) return null;
  const combo = {
    id: row.id,
    name: row.name,
    kind: row.kind,
    models: parseJson(row.models, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  // Optional context-window override; NULL = auto (max over member models).
  if (row.contextWindow != null) combo.contextWindow = Number(row.contextWindow);
  return combo;
}

export async function getCombos() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM combos ORDER BY createdAt ASC`);
  return rows.map(rowToCombo);
}

export async function getComboById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM combos WHERE id = ?`, [id]);
  return rowToCombo(row);
}

export async function getComboByName(name) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM combos WHERE name = ?`, [name]);
  return rowToCombo(row);
}

export async function createCombo(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const combo = {
    id: uuidv4(),
    name: data.name,
    kind: data.kind || null,
    models: data.models || [],
    createdAt: now,
    updatedAt: now,
  };
  // Explicit context window (optional). null/undefined → auto.
  const cw = Number(data.contextWindow);
  if (Number.isFinite(cw) && cw > 0) combo.contextWindow = Math.floor(cw);
  db.run(
    `INSERT INTO combos(id, name, kind, models, contextWindow, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [combo.id, combo.name, combo.kind, stringifyJson(combo.models), combo.contextWindow ?? null, combo.createdAt, combo.updatedAt]
  );
  return combo;
}

export async function updateCombo(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM combos WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToCombo(row), ...data, updatedAt: new Date().toISOString() };
    // contextWindow: explicit number overrides; null/"auto" clears it back to auto.
    let cw = merged.contextWindow;
    if (cw !== null && cw !== undefined) {
      const n = Number(cw);
      cw = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else {
      cw = null;
    }
    db.run(
      `UPDATE combos SET name = ?, kind = ?, models = ?, contextWindow = ?, updatedAt = ? WHERE id = ?`,
      [merged.name, merged.kind, stringifyJson(merged.models || []), cw, merged.updatedAt, id]
    );
    // Return what was actually persisted, not `merged`: the raw client payload
    // can say something the write rejected (contextWindow "auto"/0 both store
    // NULL). Handing that back made the dashboard render "0K context
    // (override)" for a combo the API reports as auto.
    result = rowToCombo(db.get(`SELECT * FROM combos WHERE id = ?`, [id]));
  });
  return result;
}

export async function deleteCombo(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM combos WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}
