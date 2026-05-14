import { promises as fs } from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '../../');
const FORBIDDEN_PATTERNS: RegExp[] = [
    /from\s+['"]@y0ngha\/siglens-core\/dist\//,
    /import\s+['"]@y0ngha\/siglens-core\/dist\//,
    /require\(['"]@y0ngha\/siglens-core\/dist\//,
];

async function walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules')
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walk(full)));
        } else if (
            entry.isFile() &&
            (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
        ) {
            files.push(full);
        }
    }
    return files;
}

describe('SCOPE — siglens import guards', () => {
    it('does not deep-import @y0ngha/siglens-core via its dist path', async () => {
        const files = await walk(SRC_ROOT);
        const offenders: Array<{ file: string; lines: string[] }> = [];

        for (const file of files) {
            const text = await fs.readFile(file, 'utf-8');
            const lines = text.split('\n');
            const hits = lines.filter(line =>
                FORBIDDEN_PATTERNS.some(p => p.test(line))
            );
            if (hits.length > 0) {
                offenders.push({
                    file: path.relative(SRC_ROOT, file),
                    lines: hits,
                });
            }
        }

        if (offenders.length > 0) {
            const message = offenders
                .map(o => `${o.file}\n    ${o.lines.join('\n    ')}`)
                .join('\n\n');
            throw new Error(
                `Found ${offenders.length} file(s) deep-importing siglens-core/dist/:\n\n${message}\n\nUse the public surface — import from '@y0ngha/siglens-core' instead.`
            );
        }

        expect(offenders).toEqual([]);
    });
});
