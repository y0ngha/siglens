import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_CLIENT_PATHS } from '@/app/ai/[locale]/aiClientPaths';

function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
        e.isDirectory()
            ? walk(join(dir, e.name))
            : e.name.endsWith('.tsx')
              ? [join(dir, e.name)]
              : []
    );
}

describe('AI_CLIENT_PATHS', () => {
    it('includes every useTranslations/getTranslations namespace used by the SiglensAI widgets/features/pages', () => {
        const files = [
            ...walk(join(process.cwd(), 'src/widgets/agent-chat')),
            ...walk(join(process.cwd(), 'src/features/agent-chat')),
            ...walk(join(process.cwd(), 'src/app/ai')),
        ].filter(f => !f.includes('__tests__'));
        const used = new Set<string>();
        for (const f of files) {
            const code = readFileSync(f, 'utf8');
            for (const m of code.matchAll(/useTranslations\('([^']+)'\)/g))
                used.add(m[1]!);
            for (const m of code.matchAll(/getTranslations\('([^']+)'\)/g))
                used.add(m[1]!);
        }
        for (const ns of used)
            expect(
                AI_CLIENT_PATHS.some(p => ns === p || ns.startsWith(`${p}.`))
            ).toBe(true);
    });

    /**
     * Task S3: the ai host also renders the shared `Header` widget tree
     * (`AuthSessionHeaderClient` → `Header`), so its namespaces must be
     * covered too. `AI_CLIENT_PATHS` covers this via `CHROME_CLIENT_PATHS`,
     * whose entries are a mix of whole namespaces (`widgets.layout`) and
     * individual leaf keys (`features.auth-logout.LogoutButton.xxxxxx`) —
     * a leaf key is a valid "namespace is covered" answer too, so the
     * predicate here also accepts an entry that is a *descendant* of the
     * used namespace, not only an ancestor/exact match.
     */
    it('includes every useTranslations namespace used by the shared header tree it now renders', () => {
        const files = [
            ...walk(join(process.cwd(), 'src/widgets/layout')),
            ...walk(join(process.cwd(), 'src/features/ticker-search')),
            ...walk(join(process.cwd(), 'src/features/auth-logout')),
            join(process.cwd(), 'src/shared/ui/ThemeToggle.tsx'),
        ].filter(
            f =>
                !f.includes('__tests__') &&
                // `Footer`/`ContactDialog` are `widgets/layout` siblings of
                // `Header` but are not part of it and are not rendered on the
                // ai host (no `<Footer>` in `src/app/ai/[locale]/layout.tsx`).
                // They run server-side (`useTranslations('shared.seo')` is
                // explicitly excluded from every client payload — see
                // `clientKeyCoverage.test.ts`), so scanning them here would
                // demand a namespace the ai host must never actually ship.
                !f.endsWith('/Footer.tsx') &&
                !f.endsWith('/ContactDialog.tsx')
        );
        const used = new Set<string>();
        for (const f of files) {
            const code = readFileSync(f, 'utf8');
            for (const m of code.matchAll(/useTranslations\('([^']+)'\)/g))
                used.add(m[1]!);
        }
        expect(used.size).toBeGreaterThan(0);
        for (const ns of used)
            expect(
                AI_CLIENT_PATHS.some(
                    p =>
                        ns === p ||
                        ns.startsWith(`${p}.`) ||
                        p.startsWith(`${ns}.`)
                )
            ).toBe(true);
    });
});
