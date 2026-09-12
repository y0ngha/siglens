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
});
