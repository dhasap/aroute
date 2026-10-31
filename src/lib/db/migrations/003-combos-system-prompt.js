// Combos: add optional systemPrompt column (per-combo injected system prompt).
// NULL = no injection. Stored as plain TEXT; injected into the request body by
// chat.js via open-sse/rtk/systemInject.js (format-aware, idempotent).
//
// Idempotent the same way migration 002 is: fresh DBs already get the column
// from the live TABLES map.
export default {
  version: 3,
  name: "combos_system_prompt",
  up(db) {
    const hasCol = (db.all(`PRAGMA table_info(combos)`) || []).some((r) => r.name === "systemPrompt");
    if (!hasCol) db.exec("ALTER TABLE combos ADD COLUMN systemPrompt TEXT");
  },
};
