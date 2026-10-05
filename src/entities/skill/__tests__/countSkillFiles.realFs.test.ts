import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { countSkillFiles } from '@/entities/skill/api';

const SKILLS_DIR = join(process.cwd(), 'skills');

const mdCount = (dir: string): number =>
    readdirSync(join(SKILLS_DIR, dir)).filter(f => f.endsWith('.md')).length;

/**
 * 실제 `skills/` 디렉터리 기준 — 화면이 말하는 개수가 사용자에게 보이는 개별 스킬 파일 수와
 * 같은지(내부 primer인 `_core/`가 섞이지 않았는지)를 못 박는다. 스킬을 추가·삭제해도
 * 디렉터리를 세므로 이 테스트는 따라온다.
 */
describe('countSkillFiles (실제 skills/ 디렉터리)', () => {
    it('지표·캔들·패턴·전략·지지/저항 개수가 각 디렉터리의 .md 수와 같다(_core 제외)', async () => {
        const counts = await countSkillFiles();

        expect(counts.indicators).toBe(mdCount('indicators'));
        expect(counts.candlesticks).toBe(mdCount('candlesticks'));
        expect(counts.patterns).toBe(mdCount('patterns'));
        expect(counts.strategies).toBe(mdCount('strategies'));
        expect(counts.supportResistance).toBe(mdCount('support-resistance'));
    });
});
