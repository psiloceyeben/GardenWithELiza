const { readFileSync } = require('node:fs');
const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const p of Object.values(snapshot.players)) if (!p.seeds.length) {
  console.log(JSON.stringify({ id: p.id, sap: p.sap, seedsBought: p.stats.seedsBought, prices: p.conveyor.slots.map(s => s.price) }));
}
