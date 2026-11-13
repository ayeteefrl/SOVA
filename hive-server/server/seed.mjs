// First boot on an empty volume: copy seed files that are missing from QT_DATA_DIR. A volume mounted at the
// data path hides anything baked into the image there, so seeds live at a separate path (HIVE_SEED_DIR).
//
// Existing files are never overwritten (deals history and fresher downloads win). Modification times are
// kept, so upstox.mjs still sees an old instrument list as stale and re-downloads it; the seed is only the
// fallback for when Upstox's instrument file can't be fetched.
import fs from "node:fs";
import path from "node:path";

export function copySeeds(seedDir, dataDir, log = console.log) {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(seedDir)) return [];
  const copied = [];
  const walk = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const a = path.join(from, e.name);
      const b = path.join(to, e.name);
      if (e.isDirectory()) walk(a, b);
      else if (e.isFile() && !fs.existsSync(b)) {
        fs.copyFileSync(a, b, fs.constants.COPYFILE_EXCL);
        const st = fs.statSync(a);
        fs.utimesSync(b, st.atime, st.mtime);
        copied.push(path.relative(dataDir, b));
      }
    }
  };
  walk(seedDir, dataDir);
  if (copied.length) log(`[data] seeded ${copied.length} file(s) into the data folder: ${copied.join(", ")}`);
  return copied;
}
