import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Skill } from '@/domain/types';
import type { SkillsProvider } from './types';

const SKILLS_DIR = join(process.cwd(), 'skills');

const parseYamlValue = (value: string): unknown => {
    if (value === '[]') return [];
    if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim();
        if (inner === '') return [];
        return inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    }
    const num = Number(value);
    if (value !== '' && !isNaN(num)) return num;
    return value;
};

const parseFrontmatter = (
    raw: string
): { data: Record<string, unknown>; content: string } | null => {
    const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
    if (!match) return null;

    const data = match[1]
        .split('\n')
        .filter(line => line.includes(':'))
        .reduce<Record<string, unknown>>((acc, line) => {
            const colonIdx = line.indexOf(':');
            const key = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim();
            return { ...acc, [key]: parseYamlValue(val) };
        }, {});

    return { data, content: match[2].trim() };
};

const toSkill = (data: Record<string, unknown>, content: string): Skill => ({
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    type: data.type === 'pattern' ? 'pattern' : undefined,
    indicators: Array.isArray(data.indicators)
        ? (data.indicators as string[])
        : [],
    confidenceWeight:
        typeof data.confidence_weight === 'number' ? data.confidence_weight : 0,
    content,
});

export class FileSkillsLoader implements SkillsProvider {
    async loadSkills(): Promise<Skill[]> {
        const files = await readdir(SKILLS_DIR);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        const skills = await Promise.all(
            mdFiles.map(async file => {
                const raw = await readFile(join(SKILLS_DIR, file), 'utf-8');
                const parsed = parseFrontmatter(raw);
                if (!parsed) return null;
                return toSkill(parsed.data, parsed.content);
            })
        );

        return skills.filter((s): s is Skill => s !== null);
    }
}
