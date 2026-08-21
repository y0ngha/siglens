import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
} from '@/shared/db/contentTranslationFields';

const ROOT = path.resolve(__dirname, '../../../..');

/**
 * `TRANSLATABLE_ENTITY`에 등록만 하고 **읽지 않는** 엔티티를 잡는다.
 *
 * 이게 없어서 실제로 사고가 났다: `news`/`marketNews`의 요약·본문 번역은
 * 계산·캐시·페이로드 적재까지 다 되는데 카드가 `item.summaryKo`를 그대로
 * 렌더했다. `/ja` 방문자는 번역된 제목 아래 한국어 본문을 봤고, 번역 비용은
 * 매번 나갔다. 화면이 멀쩡해 보이고 테스트도 통과하므로 눈으로는 못 잡는다.
 *
 * 판정은 "프로덕션 소스에서 `TRANSLATABLE_ENTITY.<key>`를 참조하는 파일이
 * 레지스트리·스크립트·테스트 말고 하나라도 있는가"다. 백필/번역 스크립트만
 * 참조하면 그게 곧 write-only다.
 */
function referencingFiles(key: string): string[] {
    try {
        const out = execFileSync(
            'git',
            ['grep', '-l', '--', `TRANSLATABLE_ENTITY.${key}`, 'src', 'db'],
            { cwd: ROOT, encoding: 'utf8' }
        );
        return out.split('\n').filter(Boolean);
    } catch {
        // `git grep`은 매치가 없으면 exit 1이다 — 실패가 아니라 "0건".
        return [];
    }
}

const NOT_A_READER = (file: string) =>
    file.includes('__tests__') ||
    file.startsWith('db/scripts/') ||
    file === 'src/shared/db/contentTranslationFields.ts';

describe('content translation registry', () => {
    const keys = Object.keys(TRANSLATABLE_ENTITY);

    it.each(keys)('%s: 읽는 프로덕션 경로가 있다', key => {
        const readers = referencingFiles(key).filter(f => !NOT_A_READER(f));
        expect(
            readers,
            `TRANSLATABLE_ENTITY.${key}는 백필·번역만 하고 읽는 곳이 없다. ` +
                '읽기 경로를 붙이거나 레지스트리에서 빼라.'
        ).not.toHaveLength(0);
    });

    it('CONTENT_FIELD 키가 TRANSLATABLE_ENTITY와 정확히 일치한다', () => {
        expect(Object.keys(CONTENT_FIELD).toSorted()).toEqual(keys.toSorted());
    });
});
