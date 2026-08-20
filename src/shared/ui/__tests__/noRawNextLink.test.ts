import { grepFiles } from '@/shared/test-utils/grepSource';

/**
 * `next/link` 직접 사용 금지 가드.
 *
 * 앱 코드가 `next/link`를 직접 쓰면 그 링크는 로케일을 잃는다 — `/en/…`에서
 * 눌렀을 때 접두사 없는 경로로 이동하고 프록시가 그것을 ko로 해석한다.
 * 빌드도 타입체크도 통과하고, 테스트가 href 리터럴만 단언하면 그것도 통과한다.
 * 그래서 소스 레벨에서 막는다.
 */
describe('next/link 직접 사용 금지', () => {
    it('LocaleLink 외에는 next/link를 import하지 않는다', () => {
        // `grep … || true`를 쓰지 않는 이유는 `grepSource.ts` JSDoc 참고 —
        // 매치 없음(1)과 실행 실패(2)를 같은 "통과"로 만들어 가드가 거짓말한다.
        const offenders = grepFiles(String.raw`from 'next/link'`, ['src'])
            // LocaleLink 자신과 테스트(next/link를 mock하는 파일)는 예외.
            .filter(
                file =>
                    !file.includes('LocaleLink') &&
                    !file.includes('__tests__') &&
                    !file.includes('.test.')
            );
        expect(offenders).toEqual([]);
    });

    it('양성 대조: 검색이 실제로 동작한다', () => {
        // 0건 통과인지 검색 고장인지 구분한다. LocaleLink는 반드시 존재한다.
        expect(
            grepFiles(String.raw`from 'next/link'`, ['src']).length
        ).toBeGreaterThan(0);
    });
});
