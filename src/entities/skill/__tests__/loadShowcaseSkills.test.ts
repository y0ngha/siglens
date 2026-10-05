import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FileSkillsLoader, loadShowcaseSkills } from '@/entities/skill/api';

const CORE_DIR = join(process.cwd(), 'skills', '_core');

/** `_core/*.md` front-matter `name:` — 쇼케이스에 나가면 안 되는 이름들. */
const coreSkillNames = readdirSync(CORE_DIR)
    .filter(file => file.endsWith('.md'))
    .map(
        file =>
            /^name:\s*(.+)$/m.exec(
                readFileSync(join(CORE_DIR, file), 'utf8')
            )?.[1]
    )
    .filter((name): name is string => name !== undefined)
    .map(name => name.trim());

/**
 * 실제 `skills/` 디렉터리를 읽는다 — 목 파일시스템으로는 "`_core`가 진짜 어디 있는가"를
 * 검증하지 못한다. `_core`는 프롬프트에 항상 주입되는 모델용 압축 요약이라(`description`이
 * "압축 primer — 상시 주입되는 코어" 같은 내부 문장이다) 공개 홈에 카드로 나가면 안 된다.
 */
describe('loadShowcaseSkills', () => {
    it('_core 스킬을 실제로 찾아낸다 — 0건이면 아래 단언이 조용히 무력화된다', () => {
        expect(coreSkillNames.length).toBeGreaterThanOrEqual(3);
    });

    it('_core 스킬이 하나도 없다', async () => {
        const names = (await loadShowcaseSkills()).map(skill => skill.name);

        for (const coreName of coreSkillNames) {
            expect(names).not.toContain(coreName);
        }
    });

    it('_core를 뺀 나머지는 전부 남는다 — 전체 로더보다 정확히 _core 개수만큼 적다', async () => {
        const [showcase, all] = await Promise.all([
            loadShowcaseSkills(),
            new FileSkillsLoader().loadSkills(),
        ]);

        expect(showcase).toHaveLength(all.length - coreSkillNames.length);
    });

    it('전체 로더(개수 집계의 소스)는 _core를 그대로 포함한다 — 집계 기준을 바꾸지 않는다', async () => {
        const names = (await new FileSkillsLoader().loadSkills()).map(
            skill => skill.name
        );

        for (const coreName of coreSkillNames) {
            expect(names).toContain(coreName);
        }
    });
});
