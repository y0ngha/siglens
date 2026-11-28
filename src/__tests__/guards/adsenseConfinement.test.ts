import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **AdSense 코드 위치 가드.**
 *
 * 광고 단위(`<ins class="adsbygoogle">`)와 광고 스크립트는 `features/ad-slot`의 `AdSlot` 한 곳에서만
 * 만든다. 그래야 모든 광고가 같은 노출 조건(사람 입력, Pro 제외, 내용 있는 화면, 고정 크기, "광고" 라벨)을
 * 지난다. 다른 곳에 광고 코드를 직접 넣으면 그 조건을 건너뛴다 — 예전 AI 패널 광고가 로딩 화면과 버튼
 * 옆에 붙었던 것처럼 정책 위반 자리가 생기고, 스크립트를 모든 페이지에 다시 싣게 된다.
 *
 * `src/proxy.ts`는 AI 사이트 CSP의 이미지 허용 호스트(Google 광고 전환 픽셀)라 예외다.
 */
const SRC_DIR = path.resolve(__dirname, '../..');

const ALLOWED = [
    'src/features/ad-slot/',
    'src/shared/lib/adsense.ts',
    'src/proxy.ts',
];

const AD_CODE = /adsbygoogle|googlesyndication/;

function isTestFile(rel: string): boolean {
    return /(^|\/)__tests__\//.test(rel) || /\.test\.tsx?$/.test(rel);
}

describe('AdSense 코드는 features/ad-slot 밖에 없다', () => {
    it('광고 단위·스크립트 문자열이 허용 경로 밖 소스에 0건이다', () => {
        const offenders = readdirSync(SRC_DIR, {
            recursive: true,
            encoding: 'utf8',
        })
            .map(rel => `src/${rel.split(path.sep).join('/')}`)
            .filter(rel => /\.(ts|tsx)$/.test(rel))
            .filter(rel => !isTestFile(rel))
            .filter(rel => !ALLOWED.some(prefix => rel.startsWith(prefix)))
            .filter(rel =>
                AD_CODE.test(
                    readFileSync(path.join(SRC_DIR, '..', rel), 'utf8')
                )
            )
            .sort();

        expect(offenders).toEqual([]);
    });
});
