// Combos: add optional contextWindow override column.
// NULL = auto (max context window across member models). An explicit value
// lets a combo advertise a window that differs from its members, e.g. a
// "sonnet-pro" combo capped at 2M regardless of what the members report.
//
// Idempotent: migration 001 builds tables from the live TABLES map, which now
// includes contextWindow, so on a fresh DB the column already exists and a raw
// ALTER would raise "duplicate column name". Guard with PRAGMA table_info the
// same way syncSchemaFromTables does.
export default {
  version: 2,
  name: "combos_context_window",
  up(db) {
    const hasCol = (db.all(`PRAGMA table_info(combos)`) || []).some((r) => r.name === "contextWindow");
    if (!hasCol) db.exec("ALTER TABLE combos ADD COLUMN contextWindow INTEGER");
  },
};
