import path from 'path';
import { glob } from 'glob';
import { describe, expect, it } from 'vitest';
import { parseSeedFile, validateSeedFiles } from '@/../db/scripts/seedTerms';

describe('db/seeds/terms (real files)', () => {
    it('every seed parses and the set validates (no version gap, no orphan translation)', async () => {
        const root = path.resolve(process.cwd(), 'db/seeds/terms');
        const files = await glob('**/*.md', { cwd: root, absolute: true });
        const seeds = files.map(parseSeedFile);
        expect(() => validateSeedFiles(seeds)).not.toThrow();
        expect(
            seeds
                .filter(s => s.kind === 'privacy' && s.version === 6)
                .map(s => s.locale ?? 'ko')
                .toSorted()
        ).toEqual(['en', 'ja', 'ko', 'zh']);
    });

    /**
     * 변수 자리표시자에서 남은 "X은(는)"·"X이(가)" 같은 조사 병기를 현행 원문에 두지 않는다.
     * 이전 버전은 당시 동의한 원문 기록이라 검사하지 않는다(행을 고치지 않는다).
     */
    it('현행 한국어 원문에 조사 병기 표기가 없다', async () => {
        const root = path.resolve(process.cwd(), 'db/seeds/terms');
        const files = await glob('**/*.md', { cwd: root, absolute: true });
        const originals = files
            .map(parseSeedFile)
            .filter(seed => seed.locale === undefined);
        const latest = ['privacy', 'tos'].map(kind =>
            originals
                .filter(seed => seed.kind === kind)
                .reduce((a, b) => (b.version > a.version ? b : a))
        );
        expect(latest).toHaveLength(2);
        const offenders = latest.flatMap(seed =>
            [
                ...seed.body.matchAll(
                    /[A-Za-z가-힣]\((?:은|는|이|가|을|를|와|과|으)\)[가-힣]?/g
                ),
            ].map(match => `${seed.kind} v${seed.version}: ${match[0]}`)
        );
        expect(offenders).toEqual([]);
    });
});
