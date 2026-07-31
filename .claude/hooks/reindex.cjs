#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const EXCLUDE_DIRS = new Set(['_archive', '_templates']);
const CATEGORY_TITLES = {
  context: 'Context',
  decisions: 'Decisions',
  patterns: 'Patterns',
  bugs: 'Bugs',
  'code-issues': 'Code issues',
  sessions: 'Sessions',
  research: 'Research',
};

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (mm) fm[mm[1]] = mm[2].trim();
  }
  return fm;
}

function walk(dir, base, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), base, out);
    } else if (entry.name.endsWith('.md') && entry.name !== 'INDEX.md') {
      const full = path.join(dir, entry.name);
      const rel = path.relative(base, full).split(path.sep).join('/');
      out.push({ full, rel, category: rel.split('/')[0] });
    }
  }
}

function generateIndex(memoryRoot, projectName) {
  const files = [];
  walk(memoryRoot, memoryRoot, files);
  const groups = {};
  const noFm = [];
  for (const f of files) {
    const fm = parseFrontmatter(fs.readFileSync(f.full, 'utf8'));
    if (!fm || !fm.name || !fm.description) { noFm.push(f.rel); continue; }
    (groups[f.category] = groups[f.category] || []).push({
      name: fm.name, description: fm.description,
      status: fm.status || '', updated: fm.updated || '',
    });
  }
  const lines = [];
  lines.push('<!-- AUTO-GENEROVÁNO reindex.js — NEEDITUJ ručně. Zdroj pravdy = frontmatter souborů. -->');
  lines.push('# Index paměti — ' + projectName);
  lines.push('');
  lines.push('> Plný katalog on-demand záznamů. Always-load vrstvu viz auto-memory/MEMORY.md.');
  lines.push('');
  const order = Object.keys(CATEGORY_TITLES);
  const cats = Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const cat of cats) {
    lines.push('## ' + (CATEGORY_TITLES[cat] || cat));
    const items = groups[cat].sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    for (const it of items) {
      const meta = [it.status, it.updated].filter(Boolean).join(' · ');
      lines.push('- [[' + it.name + ']] — ' + it.description + (meta ? ' · ' + meta : ''));
    }
    lines.push('');
  }
  if (noFm.length) {
    lines.push('## ⚠️ Bez frontmatteru');
    for (const r of noFm.sort()) lines.push('- ' + r);
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  try {
    const settingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    let autoDir = settings.autoMemoryDirectory;
    if (!autoDir) return;
    autoDir = autoDir.replace(/^~(?=$|[/\\])/, os.homedir());
    const claudeDir = path.dirname(autoDir);
    const memoryRoot = path.join(claudeDir, 'memory');
    if (!fs.existsSync(memoryRoot)) return;
    const projectName = settings.autoMemoryProjectName || path.basename(path.dirname(claudeDir));
    const out = generateIndex(memoryRoot, projectName);
    fs.writeFileSync(path.join(memoryRoot, 'INDEX.md'), out + '\n', 'utf8');
  } catch (e) {
    // fail-soft: nikdy neblokuj start session
  }
}

module.exports = { generateIndex, parseFrontmatter };

if (require.main === module) main();
