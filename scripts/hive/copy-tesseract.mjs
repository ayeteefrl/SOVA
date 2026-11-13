// Self-hosts tesseract.js (watchlist OCR) under public/hive/tesseract, so /charts needs no CDN and its CSP stays
// 'self'. Re-run after changing the tesseract.js version:  npm run hive:assets
// The language file (eng.traineddata.gz, "4.0.0_best_int", the model tesseract.js 5 uses by default) comes from
// the npm package @tesseract.js-data/eng@1.0.0; pass the unpacked package folder as the first argument to refresh it.
import fs from "node:fs";
import path from "node:path";
const out = path.join("public", "hive", "tesseract");
fs.mkdirSync(path.join(out, "lang"), { recursive: true });
const copy = (from, to) => { fs.copyFileSync(from, path.join(out, to)); console.log("copied", to); };
copy("node_modules/tesseract.js/dist/worker.min.js", "worker.min.js");
// createWorker("eng") uses the LSTM engine, so only the LSTM builds of the core are ever loaded.
for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"]) copy(`node_modules/tesseract.js-core/${f}`, f);
const lang = process.argv[2];
if (lang) copy(path.join(lang, "4.0.0_best_int", "eng.traineddata.gz"), "lang/eng.traineddata.gz");
