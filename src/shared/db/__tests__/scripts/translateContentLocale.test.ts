import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TRANSLATABLE_ENTITY } from '@/shared/db/contentTranslationFields';

const SOURCE = readFileSync(
    join(process.cwd(), 'db/scripts/translateContentLocale.ts'),
    'utf8'
);

describe('translateContentLocale 파이프라인', () => {
    /**
     * 백필만으로는 `ko` 행밖에 없어서, 스위치를 켜도 폴백이 걸려 한국어가
     * 그대로 나간다. **비-ko 행을 만드는 것은 이 스크립트뿐이다** — 없으면
     * "DB 다국어"는 기계만 있고 데이터가 없는 상태다.
     */
    it('비-ko 로케일을 대상으로 한다', () => {
        expect(SOURCE).toContain('--locale');
        expect(SOURCE).toContain('는 원문이다 — 번역 대상이 아니다');
    });

    /**
     * 약관은 오역이 곧 의무의 변경이라 읽기 경로가 `source='human'`만 본다.
     * AI로 채우면 화면에는 안 나오면서 행만 쌓여 "번역됨" 착시를 준다.
     */
    it('terms를 AI 번역 대상에서 제외한다', () => {
        expect(SOURCE).toContain('TRANSLATABLE_ENTITY.terms');
        expect(SOURCE).toContain('EXCLUDED_ENTITIES');
    });

    /**
     * 종목명·지표명은 제외 목록이 아니라 **레지스트리 자체**에 없다 — 비-ko
     * 표시 경로가 이미 영문 원본을 쓰므로 번역할 원본이 없다
     * (`contentTranslationFields.ts` 주석). 여기서 다시 거르면 두 곳이 갈린다.
     */
    it('레지스트리에 없는 것을 제외 목록으로 다시 거르지 않는다', () => {
        expect(SOURCE).not.toContain('TRANSLATABLE_ENTITY.assetName');
        expect(SOURCE).not.toContain('TRANSLATABLE_ENTITY.economicIndicator');
    });

    it.each([
        TRANSLATABLE_ENTITY.news,
        TRANSLATABLE_ENTITY.marketNews,
        TRANSLATABLE_ENTITY.notice,
        TRANSLATABLE_ENTITY.economicCalendar,
    ])('%s는 제외 목록에 없다', entity => {
        const excludedBlock = SOURCE.slice(
            SOURCE.indexOf('EXCLUDED_ENTITIES'),
            SOURCE.indexOf('interface PendingRow')
        );
        expect(excludedBlock).not.toContain(`'${entity}'`);
    });

    /**
     * 키가 없을 때 조용히 원문을 복사하면 그 행이 "번역됨"으로 저장되고,
     * 화면에는 한국어가 나가면서 재실행 대상에서도 빠진다.
     */
    it('API 키가 없으면 던진다 — 원문을 복사하지 않는다', () => {
        expect(SOURCE).toContain('GEMINI_API_KEY(또는 GOOGLE_API_KEY)가 없다');
    });

    /** 카탈로그와 다른 용어를 쓰면 같은 화면에서 용어가 갈린다. */
    it('카탈로그와 같은 용어집을 쓴다', () => {
        expect(SOURCE).toContain('messages/glossary.json');
    });

    /** 41배치가 42번째의 JSON 오류 하나로 날아간 적이 있다. */
    it('배치마다 커밋한다', () => {
        const loopBody = SOURCE.slice(SOURCE.indexOf('for (let index = 0'));
        expect(loopBody).toContain('INSERT INTO content_translations');
    });

    /** 이미 번역된 행을 다시 번역하면 토큰이 매번 다시 든다. */
    it('이미 번역된 행은 SQL에서 거른다', () => {
        expect(SOURCE).toContain('NOT EXISTS');
    });

    /** 실패 배치를 성공으로 오인하면 누락이 조용히 남는다. */
    it('실패 배치가 있으면 exit 1', () => {
        expect(SOURCE).toContain(
            'if (summary.failedBatches > 0) process.exit(1)'
        );
    });

    /** `backfillContentLocale.ts`와 같은 이유 — DB 계층 import는 실행 불가다. */
    it('server-only에 닿는 모듈을 import하지 않는다', () => {
        const imports = [...SOURCE.matchAll(/from '([^']+)'/g)].map(
            match => match[1]!
        );
        for (const specifier of imports.filter(item =>
            item.includes('/src/')
        )) {
            expect(specifier).not.toMatch(/shared\/db\/(client|schema|types)/);
        }
    });
});
