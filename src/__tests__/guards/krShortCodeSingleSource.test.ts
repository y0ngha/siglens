import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCAN_TIMEOUT_MS, sourceFiles } from './support/controlUsage';

/**
 * **KRX 단축코드 형상 단일 출처 가드.**
 *
 * KRX 단축코드 형상은 `KR_SHORT_CODE_PATTERN`(`src/shared/config/ticker.ts`) 한 곳에서만
 * 정의하고, 소비처는 그 소스로 정규식을 파생한다. 2026-10-15까지 수집(`toShortCode`)·심볼
 * 판정(`KR_SYMBOL_RE`)·종목코드 검색·스크립트가 각자 `\d{6}`를 하드코딩해, 영문이 섞인
 * 신규 상장 코드(`0001A0`)를 쓰는 64종목이 수집에서 빠지고 페이지가 404였다. 한 곳만
 * 고치면 나머지 경로에서 조용히 다시 빠지므로 재발을 여기서 막는다.
 *
 * 잡는 형태는 `\d{6}` 뒤에 거래소 접미사(`K[SQ]`)가 붙은 정규식이다. 접미사 없는
 * `\d{6}`는 이메일 인증 코드 같은 무관한 용도가 있어 일괄 금지하지 않는다 — 수집 단계의
 * 단축코드 판정은 `krxListedInfoClient.test.ts`의 영문코드 케이스가 지킨다.
 * 단위 테스트 파일은 픽스처 문자열을 다루므로 제외한다.
 */
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SCAN_DIRS = ['src', 'scripts', 'e2e'];
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs'];
const HARDCODED_KR_CODE = /\\d\{6\}[^\n]{0,8}K\[SQ\]/;

/** 단위 테스트 파일. e2e `*.spec.ts`는 제품 동작을 단언하므로 스캔 대상이다. */
function isUnitTestFile(file: string): boolean {
    return /[\\/]__tests__[\\/]|\.test\.tsx?$/.test(file);
}

describe('KRX 단축코드 형상 단일 출처', () => {
    it(
        'src·scripts·e2e에 `\\d{6}…K[SQ]` 하드코딩이 없다',
        () => {
            const offenders = SCAN_DIRS.flatMap(dir =>
                sourceFiles(path.join(REPO_ROOT, dir), EXTENSIONS)
            )
                .filter(file => !isUnitTestFile(file))
                .filter(file =>
                    HARDCODED_KR_CODE.test(readFileSync(file, 'utf8'))
                )
                .map(file => path.relative(REPO_ROOT, file));

            expect(offenders).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );
});
