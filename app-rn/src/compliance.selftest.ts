import { selfTest } from './rules';
const r = selfTest();
for (const t of r) console.log(`${t.pass ? '✔' : '✘'} ${t.name}`);
console.log(`${r.filter((t) => t.pass).length}/${r.length} casos pasan`);
process.exit(r.every((t) => t.pass) ? 0 : 1);
