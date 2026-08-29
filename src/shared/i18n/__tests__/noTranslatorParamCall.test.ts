import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

/**
 * **번역자를 인자로 받는 파일에서 `t('리터럴')`을 부르지 않는다.**
 *
 * 추출기는 그런 파일을 조기 반환으로 건너뛴다 —
 * `keysForFiles`의 `translatorNamespace.size === 0`. 그래서 그 키는 **클라이언트
 * 페이로드에 실리지 않는다.** 반면 `collectReferencedKeys`는 파일 종류를 안 가려
 * `ko.json`에는 남으므로, `i18n:verify`도 extract 드리프트 게이트도 통과한다.
 *
 * 실제로 그렇게 냈다: 종목 페이지의 **가시 h1**이 네 로케일 전부에서 문자열
 * `views.symbol.chartPageHeading.heading`을 렌더했다. SSR HTML은 정상이라
 * 크롤러와 사용자가 서로 다른 것을 봤다 — cloaking이다.
 *
 * `clientKeyCoverage`는 이걸 못 잡는다. 그 가드도 **같은 조기 반환**을 쓰기
 * 때문이다(추출기와 같은 모델을 공유하는, 이 브랜치에서 반복된 실패다).
 * 그래서 여기서는 커버리지를 세지 않고 **패턴 자체를 금지**한다.
 *
 * 올바른 형태: 헬퍼는 **키만 내보내고**(`export const X_KEY = '...'`)
 * `t()` 호출은 번역자를 선언한 소비 파일에서 한다.
 */
describe('번역자를 인자로 받는 파일은 t(리터럴)을 부르지 않는다', () => {
    const sources = execSync(
        `find ${JSON.stringify(`${ROOT}/src`)} -name '*.ts' -o -name '*.tsx'`,
        { encoding: 'utf8', maxBuffer: 1 << 28 }
    )
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(f => f.replace(`${ROOT}/`, ''))
        .filter(
            rel => !rel.includes('__tests__') && !rel.includes('test-utils')
        );

    /** `t: SeoTranslator` / `(t, ...)` 처럼 번역자를 **받는** 파일. */
    const RECEIVES_TRANSLATOR =
        /\b(?:t|tLabel|tSeo|tNav|tRoot)\s*:\s*(?:SeoTranslator|EnumLabelTranslator|\(\s*key)/;
    /** 자기 파일에서 번역자를 **선언**하는가. */
    const DECLARES_TRANSLATOR =
        /(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(/;

    /**
     * 이 패턴이 **위험해지는 건 클라이언트 번들 안에서뿐**이다. 서버 컴포넌트는
     * 요청 스코프에서 전체 카탈로그를 읽으므로 페이로드 누락이 성립하지 않는다.
     *
     * 아래 파일들은 현재 **서버 전용**이다 — `generateMetadata`와 서버 컴포넌트
     * 에서만 호출된다. 목록이 썩지 않도록 두 번째 테스트가 감시한다.
     * 새 파일이 이 패턴을 쓰면 목록에 없으므로 **테스트가 깨진다**(fail-closed).
     */
    const SERVER_ONLY = [
        'src/app/[locale]/economy/constants.ts',
        'src/app/[locale]/fear-greed/copy.ts',
        'src/app/[locale]/market/copy.ts',
        'src/app/[locale]/news/[category]/seo.ts',
        'src/shared/lib/legal.ts',
        'src/shared/lib/seo.ts',
    ];

    /** `'use client'` 파일이 이 파일의 export를 **직접 호출**하는가. */
    const calledFromClient = (rel: string): string[] => {
        const exported = [
            ...readFileSync(`${ROOT}/${rel}`, 'utf8').matchAll(
                /export (?:async )?function ([A-Za-z_$][\w$]*)/g
            ),
        ].map(m => m[1]!);
        if (exported.length === 0) return [];
        return sources.filter(other => {
            if (other === rel) return false;
            const code = readFileSync(`${ROOT}/${other}`, 'utf8');
            if (!code.startsWith("'use client'")) return false;
            return exported.some(fn => new RegExp(`\\b${fn}\\(`).test(code));
        });
    };

    /**
     * 면제 판정은 **하드코딩 목록이 아니라 실제 도달 여부**로 한다.
     *
     * 목록만 쓰면 새로 추가된 서버 전용 헬퍼가 전부 위반으로 잡히고(오탐),
     * 반대로 목록에 있는 파일이 나중에 클라이언트로 흘러도 통과한다(미탐).
     * `calledFromClient`가 그 둘을 한 번에 없앤다 — `SERVER_ONLY`는 이제
     * "이미 확인했다"는 기록으로만 남고, 판정에는 쓰지 않는다.
     */
    const offenders = sources
        .filter(rel => calledFromClient(rel).length > 0)
        .flatMap(rel => {
            const code = readFileSync(`${ROOT}/${rel}`, 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/(?<![:/])\/\/.*$/gm, '');
            if (!RECEIVES_TRANSLATOR.test(code)) return [];
            if (DECLARES_TRANSLATOR.test(code)) return [];

            return [
                ...code.matchAll(
                    /\b(?:t|tLabel|tSeo|tNav|tRoot)(?:\.(?:rich|markup|raw))?\(\s*'([A-Za-z0-9_.$-]+)'/g
                ),
            ].map(m => `${rel} → t('${m[1]}')`);
        });

    it('대상 파일을 실제로 찾아낸다', () => {
        // 번역자를 인자로 받는 헬퍼가 0건이면 이 가드가 무의미해진다.
        const receivers = sources.filter(rel =>
            RECEIVES_TRANSLATOR.test(readFileSync(`${ROOT}/${rel}`, 'utf8'))
        );

        expect(receivers.length).toBeGreaterThan(3);
    });

    it('위반이 없다', () => {
        expect(offenders).toEqual([]);
    });

    it('서버 전용 목록이 썩지 않았다', () => {
        // 목록의 파일이 클라이언트에서 호출되기 시작하면 면제가 무효다.
        const leaked = SERVER_ONLY.flatMap(rel =>
            calledFromClient(rel).map(caller => `${rel} ← ${caller}`)
        );

        expect(leaked).toEqual([]);
    });
});
