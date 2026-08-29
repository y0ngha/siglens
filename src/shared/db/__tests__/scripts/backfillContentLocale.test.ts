import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
    TRANSLATABLE_ENTITY_VALUES,
} from '@/shared/db/contentTranslationFields';

const SOURCE = readFileSync(
    join(process.cwd(), 'db/scripts/backfillContentLocale.ts'),
    'utf8'
);

/**
 * 백필이 엔티티를 빠뜨리면 **그 테이블만 조용히 번역되지 않는다** — 사이드카에
 * ko 행이 없으니 읽기 경로가 레거시 컬럼으로 폴백해 화면은 멀쩡해 보이고,
 * 그 테이블의 번역 파이프라인만 영원히 시작되지 않는다.
 */
describe('backfillContentLocale 커버리지', () => {
    /**
     * 레지스트리에 남은 것은 전부 사이드카 대상이다 — 로케일이 행의 정체성인
     * 테이블(`seo_analysis_snapshots`, `shared_analyses`)은 `locale` 컬럼을
     * 쓰므로 애초에 등록하지 않는다(`contentTranslationFields.ts` 주석).
     */
    it.each(TRANSLATABLE_ENTITY_VALUES)('%s 백필 소스가 있다', entity => {
        const key = Object.entries(TRANSLATABLE_ENTITY).find(
            ([, value]) => value === entity
        )![0];
        expect(SOURCE).toContain(`TRANSLATABLE_ENTITY.${key}`);
    });

    /**
     * 필드명은 `CONTENT_FIELD` 상수를 통해야 한다 — 원시 문자열을 SQL에 박으면
     * 읽기 경로가 쓰는 이름과 어긋나도 아무도 모른다(폴백이 걸려 화면은 정상).
     */
    it('필드명을 문자열 리터럴로 박지 않는다', () => {
        for (const field of Object.values(CONTENT_FIELD.news)) {
            expect(SOURCE).not.toContain(`'${field}' AS field`);
        }
    });

    /**
     * **모든 SELECT의 첫 컬럼이 `id`로 별칭돼야 한다.**
     *
     * 원본 PK 이름이 테이블마다 다르다(`id`·`symbol`·`normalized_name`).
     * 별칭을 빠뜨리면 `row.id`가 `undefined`가 되고 드라이버가
     * `UNDEFINED_VALUE`로 죽는데 — **그 테이블이 비어 있으면 아무 일도 없이
     * 통과한다.** 실제로 3개 소스가 그 상태로 있었고, 빈 테이블에 돌렸을 때는
     * 초록이었다가 데이터를 넣고서야 드러났다.
     */
    it.each([
        ['symbol', 'asset_translations / profile_description'],
        ['normalized_name', 'economic_indicator_translations'],
        ['id::text', 'notices / terms (uuid)'],
    ])('%s를 그대로 SELECT하지 않는다 (%s)', column => {
        // `AS id` 없이 그 컬럼으로 시작하는 SELECT가 없어야 한다.
        const bare = new RegExp(
            `SELECT\\s+${column.replace('::', '::')}\\s*,`,
            'g'
        );
        expect(SOURCE).not.toMatch(bare);
    });

    /** 별칭을 빠뜨려도 조용히 지나가지 않도록 런타임 방어선이 있어야 한다. */
    it('id가 문자열이 아니면 즉시 던진다', () => {
        expect(SOURCE).toContain("typeof row.id !== 'string'");
    });

    /** 실수로 프로덕션에 대고 돌렸을 때 아무 일도 안 일어나는 편이 낫다. */
    it('기본이 dry-run이다', () => {
        expect(SOURCE).toContain("process.argv.includes('--apply')");
    });

    /**
     * 백필이 원본 한국어를 `human`으로 승격하면 AI 산출물이 인간 번역으로
     * 둔갑하고, 약관이 그것을 신뢰하게 된다.
     */
    it('백필은 human 출처로 쓰지 않는다', () => {
        expect(SOURCE).toContain('TRANSLATION_SOURCE.ai');
        expect(SOURCE).not.toContain('TRANSLATION_SOURCE.human,');
    });

    /** 여러 번 돌려도 안전해야 한다 — 실패 후 재실행이 정상 운영이다. */
    it('멱등하다 (ON CONFLICT DO NOTHING)', () => {
        expect(SOURCE).toContain('ON CONFLICT DO NOTHING');
    });

    /**
     * **실행 가능해야 한다.**
     *
     * 첫 판은 `@/shared/db/client`를 import했다가 `MODULE_NOT_FOUND:
     * server-only`로 **실행 자체가 불가능**했다 — `server-only`는 Next 번들러가
     * 주는 가상 패키지라 `node_modules`에 실체가 없고, 이 스크립트는 Next 밖에서
     * `tsx`로 도는 순수 Node 프로세스다.
     *
     * 그때 이 파일의 다른 테스트는 전부 통과했다. 소스를 grep하기만 해서
     * "무엇이 쓰여 있는가"는 봤지만 "돌아가는가"는 보지 않았기 때문이다.
     * 로컬 Postgres에 실제로 돌려 보고서야 드러났다.
     */
    it('server-only에 닿는 모듈을 import하지 않는다 — 그러면 실행 자체가 불가능하다', () => {
        const imports = [...SOURCE.matchAll(/from '([^']+)'/g)].map(
            match => match[1]!
        );
        const srcImports = imports.filter(specifier =>
            specifier.includes('/src/')
        );

        // `src/**`를 아예 금지하지는 않는다 — 필드명 상수는 반드시 공유해야
        // 하고, 그 모듈들에는 `server-only`가 없다. 금지 대상은 DB 계층이다.
        for (const specifier of srcImports) {
            expect(specifier).not.toMatch(/shared\/db\/(client|schema|types)/);
        }
    });

    /**
     * 실제로 그 상수 모듈들이 계속 `server-only`-free여야 한다. 누가
     * `contentTranslationFields.ts`에 `import 'server-only'`를 넣으면 백필이
     * 다시 실행 불가가 되는데, 위 테스트만으로는 안 잡힌다.
     */
    it.each([
        'src/shared/db/contentTranslationFields.ts',
        'src/shared/i18n/locales.ts',
    ])('%s는 server-only가 아니다', file => {
        const content = readFileSync(join(process.cwd(), file), 'utf8');
        expect(content).not.toContain("import 'server-only'");
    });
});
