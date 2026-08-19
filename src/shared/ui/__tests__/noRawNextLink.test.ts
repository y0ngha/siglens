import { execSync } from 'node:child_process';

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
        const raw = execSync(
            "grep -rln \"from 'next/link'\" src --include='*.tsx' --include='*.ts' || true",
            { encoding: 'utf8' }
        );
        const offenders = raw
            .split('\n')
            .filter(Boolean)
            // LocaleLink 자신과 테스트(next/link를 mock하는 파일)는 예외.
            .filter(
                file =>
                    !file.includes('LocaleLink') &&
                    !file.includes('__tests__') &&
                    !file.includes('.test.')
            );
        expect(offenders).toEqual([]);
    });
});
