import type { Theme } from "./chart/engine";
import { hiveRootEl } from "./user";

// The chart reads the same CSS variables as the rest of the page (defined on .hive-root, not on <html>,
// so they never leak into SOVA).
export function readTheme(): Theme {
  const s = getComputedStyle(hiveRootEl());
  const rgb = (name: string) => `rgb(${s.getPropertyValue(name).trim().split(/\s+/).join(",")})`;
  return {
    bg: rgb("--hive-bg"),
    text: rgb("--hive-text"),
    grid: rgb("--hive-grid"),
    border: rgb("--hive-line"),
    up: rgb("--hive-up"),
    down: rgb("--hive-down"),
    accent: rgb("--hive-accent"),
    muted: rgb("--hive-muted"),
  };
}
