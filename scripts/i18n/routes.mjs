import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const APP = process.argv[2] + '/src/app';
const out = [];
function walk(dir, seg) {
    for (const name of readdirSync(dir).sort()) {
        const p = join(dir, name);
        if (!statSync(p).isDirectory()) continue;
        if (name.startsWith('_') || name === '__tests__') continue; // private folder
        const isGroup = name.startsWith('(') && name.endsWith(')');
        const next = isGroup ? seg : seg + '/' + name;
        if (existsSync(join(p, 'page.tsx')) || existsSync(join(p, 'page.ts')))
            out.push({ route: next || '/', kind: 'page' });
        if (existsSync(join(p, 'route.ts')))
            out.push({ route: next || '/', kind: 'route' });
        walk(p, next);
    }
}
if (existsSync(join(APP, 'page.tsx'))) out.push({ route: '/', kind: 'page' });
walk(APP, '');
for (const f of [
    'not-found.tsx',
    'error.tsx',
    'global-error.tsx',
    'robots.ts',
    'manifest.ts',
    'sitemap.ts',
])
    if (existsSync(join(APP, f)))
        out.push({
            route: '(' + f.replace(/\.tsx?$/, '') + ')',
            kind: 'special',
        });
const pages = out.filter(o => o.kind === 'page');
const routes = out.filter(o => o.kind === 'route');
console.log('## Pages (' + pages.length + ')');
pages.forEach(p => console.log('- ' + p.route));
console.log('\n## Route handlers (' + routes.length + ')');
routes.forEach(p => console.log('- ' + p.route));
console.log(
    '\n## Special (' + out.filter(o => o.kind === 'special').length + ')'
);
out.filter(o => o.kind === 'special').forEach(p => console.log('- ' + p.route));
