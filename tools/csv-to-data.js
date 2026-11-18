// Usage: node tools/csv-to-data.js <input.csv> <output.js> [--time=time_utc] [--value=members] [--step=10]
// Converts a time series CSV into a compact data.js for Statical (fills gaps by linear interpolation).
const fs = require("fs");
const [inFile, outFile, ...flags] = process.argv.slice(2);
if (!inFile || !outFile) { console.error("Usage: node tools/csv-to-data.js <input.csv> <output.js> [--time=col] [--value=col] [--step=min]"); process.exit(1); }
const opt = Object.fromEntries(flags.map((f) => f.replace(/^--/, "").split("=")));
const { time = "time_utc", value = "members", step = "10" } = opt;
const STEP = Number(step) * 60000;
const [head, ...lines] = fs.readFileSync(inFile, "utf8").trim().split(/\r?\n/);
const cols = head.split(",");
const ti = cols.indexOf(time), vi = cols.indexOf(value);
if (ti < 0 || vi < 0) { console.error(`Columns not found. Have: ${cols.join(", ")}`); process.exit(1); }
const rows = lines.map((l) => { const c = l.split(","); return [Date.parse(c[ti]), Number(c[vi])]; }).sort((a, b) => a[0] - b[0]);
const vals = [rows[0][1]], filled = [];
for (let i = 1; i < rows.length; i++) {
  const n = Math.round((rows[i][0] - rows[i - 1][0]) / STEP);
  for (let k = 1; k <= n; k++) {
    if (k < n) filled.push(vals.length);
    vals.push(Math.round(rows[i - 1][1] + ((rows[i][1] - rows[i - 1][1]) * k) / n));
  }
}
const gains = vals.map((v, i) => (i ? v - vals[i - 1] : 0));
gains[0] = gains[1];
const data = { start: new Date(rows[0][0]).toISOString(), stepMinutes: Number(step), base: vals[0], gains, interpolated: filled };
fs.writeFileSync(outFile, "const data = " + JSON.stringify(data) + ";\n");
console.log(`${rows.length} rows -> ${vals.length} points (${filled.length} interpolated), +${vals.at(-1) - vals[0]} total`);
