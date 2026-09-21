// Combos: add optional contextWindow override column.
// NULL = auto (max context window across member models). An explicit value
// lets a combo advertise a window that differs from its members, e.g. a
// "sonnet-pro" combo capped at 2M regardless of what the members report.
export default {
  version: 2,
  name: "combos_context_window",
  up(db) {
    db.exec("ALTER TABLE combos ADD COLUMN contextWindow INTEGER");
  },
};
