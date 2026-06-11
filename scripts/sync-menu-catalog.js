/**
 * Sincroniza route-registry.ts → backend/app/menu_catalog.py e shared/menu-catalog.json
 * Uso: node scripts/sync-menu-catalog.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const registryPath = path.join(root, 'frontend', 'src', 'app', 'core', 'route-registry.ts');
const pyPath = path.join(root, 'backend', 'app', 'menu_catalog.py');
const jsonPath = path.join(root, 'shared', 'menu-catalog.json');

const src = fs.readFileSync(registryPath, 'utf8');
const block = src.match(/export const PROTECTED_ROUTES[^=]*=\s*\[([\s\S]*?)\];/);
if (!block) {
  console.error('Não foi possível ler PROTECTED_ROUTES de route-registry.ts');
  process.exit(1);
}

const entryRe = /\{\s*menuKey:\s*'([^']+)',\s*label:\s*'([^']+)',\s*path:\s*'([^']+)'(?:,\s*navGroup:\s*'([^']+)')?/g;
const byKey = new Map();
let sort = 1;
let m;
while ((m = entryRe.exec(block[1])) !== null) {
  const [, menuKey, label, routePath, navGroup] = m;
  if (menuKey.startsWith('_')) continue;
  const existing = byKey.get(menuKey) || {
    menu_key: menuKey,
    label,
    route_paths: [],
    nav_group: navGroup || null,
    sort_order: sortOrderFor(menuKey, sort++),
  };
  if (!existing.route_paths.includes(routePath)) existing.route_paths.push(routePath);
  if (navGroup) existing.nav_group = navGroup;
  byKey.set(menuKey, existing);
}

function sortOrderFor(key, fallback) {
  const order = {
    dashboard: 1,
    fornecedores: 10,
    clientes: 11,
    produtos: 12,
    entradas: 20,
    saidas: 21,
    reservas: 30,
    atendimentos: 31,
    atendimentos_pendentes: 32,
    relatorios: 40,
    usuarios: 50,
    perfis: 51,
    permissoes: 52,
    auditoria: 53,
  };
  return order[key] ?? fallback;
}

const catalog = [...byKey.values()].sort((a, b) => a.sort_order - b.sort_order);

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

const pyLines = [
  '"""Catálogo canônico de menus/rotas — gerado por scripts/sync-menu-catalog.js."""',
  'import json',
  '',
  'MENU_CATALOG: list[dict] = [',
];
for (const e of catalog) {
  const paths = JSON.stringify(e.route_paths);
  const nav = e.nav_group ? `"${e.nav_group}"` : 'None';
  pyLines.push(
    `    {"menu_key": "${e.menu_key}", "label": "${e.label}", "route_paths": ${paths}, "nav_group": ${nav}, "sort_order": ${e.sort_order}},`,
  );
}
pyLines.push(']', '', '', 'def route_paths_json(paths: list[str]) -> str:', '    return json.dumps(paths, ensure_ascii=False)', '');
fs.writeFileSync(pyPath, pyLines.join('\n'), 'utf8');

console.log(`Sincronizado ${catalog.length} menus → menu_catalog.py e shared/menu-catalog.json`);
