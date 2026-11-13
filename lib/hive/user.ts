// Per-user browser state and the Hive root element.
//
// Every Chart Hive localStorage key is namespaced by the signed-in SOVA user id ("terminal.state.v1:<id>"), so
// two accounts on one browser never see each other's watchlists, layouts, alerts, scans, baskets or trades.
// HiveRoot sets the id (from the server-verified session) before any Hive component renders. Without it,
// hiveKey() throws, and every caller already treats storage errors as "nothing saved", so nothing is read or
// written under a shared key.

let uid: string | null = null;

export function setHiveUser(id: string) {
  if (uid && uid !== id && typeof window !== "undefined") {
    // A different account in the same page session: start clean rather than carry the previous user's
    // in-memory state. (Entering /charts is always a full page load, so this is a safety net.)
    window.location.reload();
    return;
  }
  uid = id;
}

export const hiveUser = () => uid;

export function hiveKey(base: string) {
  if (!uid) throw new Error("Hive user not set");
  return `${base}:${uid}`;
}

/** The element that holds Chart Hive's CSS variables and scoped styles. Portals render into it. */
export function hiveRootEl(): HTMLElement {
  return (typeof document !== "undefined" && document.querySelector<HTMLElement>(".hive-root")) || document.body;
}

export function setHiveTheme(theme: string) {
  const el = typeof document !== "undefined" ? document.querySelector<HTMLElement>(".hive-root") : null;
  if (el) el.dataset.theme = theme;
}
