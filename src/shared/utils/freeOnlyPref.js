// Persisted UI preference: the Providers detail page "Free only" filter.
// Kept in localStorage so checking the box survives a page refresh.
export const FREE_ONLY_STORAGE_KEY = "providers_free_only";

const getStorage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // storage access itself can throw (privacy mode)
  }
};

// Reads the saved preference. Never throws; SSR / blocked storage -> false
// (show all models), which is the pre-persistence default.
export function readFreeOnlyPref() {
  try {
    return getStorage()?.getItem(FREE_ONLY_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

// Writes the preference. Returns true only when the value was actually stored,
// false when storage is unavailable (toggle still works for the session).
export function writeFreeOnlyPref(value) {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(FREE_ONLY_STORAGE_KEY, value ? "true" : "false");
    return true;
  } catch {
    return false;
  }
}
