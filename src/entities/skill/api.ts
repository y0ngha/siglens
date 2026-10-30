import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { Skill, SkillCounts } from '@y0ngha/siglens-core';
import { isRecord } from '@/shared/lib/isRecord';
import { countSkills } from './lib/countSkills';
import { dedupeByName } from './lib/dedupeByName';
import { parseFrontmatter } from './lib/parseFrontmatter';
import { toSkill } from './lib/toSkill';
import type { SkillsProvider } from './model';

const SKILLS_DIR = join(process.cwd(), 'skills');

/**
 * 프롬프트에 **항상 주입되는 압축 요약**(`Candle Reading Primer`·`Indicator Core
 * Reference`·`Pattern Index Reference`)이 사는 디렉터리. 사용자가 읽는 가이드가 아니라
 * 모델용 내부 자료라 공개 쇼케이스에서는 뺀다 — 카드로 나가면 홈에 "압축 primer — 상시
 * 주입되는 코어" 같은 내부 문장이 그대로 노출된다.
 */
const CORE_SKILLS_DIR = join(SKILLS_DIR, '_core');

const isMissingPathError = (error: unknown): boolean =>
    isRecord(error) && error.code === 'ENOENT';

const collectMdFiles = async (dir: string): Promise<string[]> => {
    // 없는 스킬 하위 디렉터리는 빈 것으로 본다(fundamental/news처럼 Skill `.md` 카탈로그가
    // 추가되면서 늦게 만들어지는 디렉터리).
    const entries = await readdir(dir, { withFileTypes: true }).catch(
        (error: unknown) => {
            if (isMissingPathError(error)) return null;
            throw error;
        }
    );
    if (entries === null) return [];
    const results = await Promise.all(
        entries.map(async (entry: Dirent) => {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) return collectMdFiles(fullPath);
            if (entry.name.endsWith('.md')) return [fullPath];
            return [];
        })
    );
    return results.flat();
};

const readSkills = async (mdFiles: readonly string[]): Promise<Skill[]> => {
    const skills = await Promise.all(
        mdFiles.map(async file => {
            const parsed = parseFrontmatter(await readFile(file, 'utf-8'));
            return parsed ? toSkill(parsed.data, parsed.content) : null;
        })
    );

    return dedupeByName(skills.filter((s): s is Skill => s !== null));
};

const isCoreSkillFile = (file: string): boolean =>
    file.startsWith(`${CORE_SKILLS_DIR}${sep}`);

const readPublicSkills = async (): Promise<Skill[]> => {
    const mdFiles = await collectMdFiles(SKILLS_DIR);
    return readSkills(mdFiles.filter(file => !isCoreSkillFile(file)));
};

/**
 * `skills/` 전체(`_core/` 포함)를 읽는 프롬프트 주입용 로더. 쇼케이스·개수 집계와 달리
 * `_core` primer까지 읽는다.
 */
export class FileSkillsLoader implements SkillsProvider {
    async loadSkills(): Promise<Skill[]> {
        return readSkills(await collectMdFiles(SKILLS_DIR));
    }
}

/**
 * 홈 스킬 쇼케이스에 보여줄 스킬 — `skills/_core/`를 제외한 전부.
 *
 * 개수 집계(`countSkillFiles`)도 같은 기준(`_core` 제외)을 쓴다. 프롬프트 주입 경로
 * (`FileSkillsLoader`)만 `_core`까지 읽는다.
 */
export async function loadShowcaseSkills(): Promise<Skill[]> {
    return readPublicSkills();
}

/**
 * `countSkillFiles` 결과의 프로세스 메모. 성공한 집계만 남는다(실패하면 비워 다음 호출이 다시 센다).
 */
let skillCountsMemo: Promise<SkillCounts> | null = null;

/**
 * 스킬 카탈로그 규모를 frontmatter 기준으로 집계한다(`type`/`category` 필드 기준, 디렉터리
 * 기준 아님). 단 `_core/` 내부 primer는 센 값에서 뺀다(`CORE_SKILLS_DIR` 참고).
 * 홈 히어로·StatsBar, /about, /methodology, 종목 페이지의 진행 문구·가입 업셀이 모두
 * 이 함수 하나를 소스로 써서 서로 다른 수를 말하지 않는다.
 *
 * **프로세스 수명 동안 한 번만 센다.** `skills/`는 빌드 산출물이라 실행 중에는 바뀌지 않는데,
 * 예전에는 렌더마다 디렉터리를 훑고 `.md` 약 100개를 읽어 frontmatter를 파싱했다 — 종목 차트
 * 탭 렌더마다였다. 동시 호출도 같은 프라미스를 받는다.
 * 실패(EACCES 등)는 메모하지 않는다 — 호출부가 0으로 degrade한 뒤 다음 렌더가 다시 시도한다.
 * 개발 서버에서 스킬 파일을 고쳤다면 서버를 재시작해야 수가 바뀐다.
 */
export function countSkillFiles(): Promise<SkillCounts> {
    if (skillCountsMemo === null) {
        const pending = readPublicSkills().then(countSkills);
        skillCountsMemo = pending;
        pending.catch(() => {
            if (skillCountsMemo === pending) skillCountsMemo = null;
        });
    }
    return skillCountsMemo;
}

/** 테스트 전용 — `countSkillFiles` 메모를 비운다. */
export function __resetSkillCountsForTests(): void {
    skillCountsMemo = null;
}
