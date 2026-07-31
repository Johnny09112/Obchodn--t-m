'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateIndex } = require('./reindex.js');

function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reindex-'));
const mem = path.join(root, 'memory');

write(path.join(mem, 'decisions', 'alfa.md'),
  '---\nname: alfa\ndescription: Prvni rozhodnuti\ntype: decision\nstatus: active\nupdated: 2026-06-20\n---\ntelo');
write(path.join(mem, 'decisions', 'beta.md'),
  '---\nname: beta\ndescription: Druhe rozhodnuti\ntype: decision\nstatus: superseded\nupdated: 2026-06-22\n---\ntelo');
write(path.join(mem, 'bugs', 'chyba.md'),
  '---\nname: chyba\ndescription: Vyreseny bug\ntype: bug\nupdated: 2026-06-21\n---\ntelo');
write(path.join(mem, '_archive', 'stare.md'),
  '---\nname: stare\ndescription: nema byt v indexu\ntype: decision\n---\ntelo');
write(path.join(mem, '_templates', 'decision.md'),
  '---\nname: tmpl\ndescription: skeleton\n---\n');
write(path.join(mem, 'patterns', 'rozbity.md'), 'bez frontmatteru');
write(path.join(mem, 'INDEX.md'), 'stary index');

const out = generateIndex(mem, 'testproj');

assert.ok(out.includes('# Index paměti — testproj'), 'header s názvem projektu');
assert.ok(out.includes('## Decisions'), 'sekce Decisions');
assert.ok(out.includes('- [[alfa]] — Prvni rozhodnuti · active · 2026-06-20'), 'radek alfa');
assert.ok(out.includes('- [[beta]] — Druhe rozhodnuti · superseded · 2026-06-22'), 'radek beta');
assert.ok(out.indexOf('[[beta]]') < out.indexOf('[[alfa]]'), 'novejsi nahore');
assert.ok(out.includes('## Bugs'), 'sekce Bugs');
assert.ok(out.includes('- [[chyba]] — Vyreseny bug · 2026-06-21'), 'radek chyba bez statusu');
assert.ok(!out.includes('[[stare]]'), '_archive vylouceno');
assert.ok(!out.includes('[[tmpl]]'), '_templates vylouceno');
assert.ok(!out.includes('stary index'), 'INDEX.md ignorovano');
assert.ok(out.includes('## ⚠️ Bez frontmatteru'), 'sekce bez frontmatteru');
assert.ok(out.includes('- patterns/rozbity.md'), 'rozbity soubor vypsan');

console.log('PASS: reindex generateIndex');
