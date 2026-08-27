import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    PEEK_RESERVE_CSS,
    SHEET_HEIGHT_SVH,
    SNAP_PEEK,
} from '../constants/mobileSheet';

/**
 * **시트가 덮는 만큼만 비운다.** 고정 비율로 비우면 안 된다.
 *
 * 예전 차트 컬럼은 `pb: calc(SNAP_PEEK * 100svh)`로 비웠는데, 그 값은 시트가
 * 실제로 덮는 높이가 아니다. 관련된 세 길이가 **서로 다른 단위**를 쓰기 때문이다.
 *
 *   - jail 높이       `100dvh`  (툴바 상태에 따라 변함)
 *   - 시트 높이       `97svh`   (툴바가 펼쳐진 기준으로 고정)
 *   - vaul 오프셋     `(1 − snap) × window.innerHeight`  (= dvh)
 *
 * 그래서 실제 띠는 `97svh − (1 − snap)·dvh`이고, iOS Safari에서 툴바가 접혀
 * `dvh > svh`가 되면 띠는 줄어드는데 고정 예약은 그대로 남는다. 그 차이가
 * 차트 아래 **검은 빈 공간**으로 보였다(2026-08-27 사용자 제보 스크린샷).
 *
 * 예약 자체를 없앨 수는 없다. vaul은 `position: fixed`라 콘텐츠를 밀어내지
 * 않으므로, 비워 두지 않으면 거래량 차트와 면책 문구가 띠 밑으로 영구히
 * 들어간다 — peek이 최소 스냅이라 사용자가 더 내릴 수도 없다(실측 확인).
 */

const VIEWS_DIR = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        if (entry === '__tests__' || entry === 'node_modules') continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...sourceFiles(full));
        } else if (/\.tsx?$/.test(entry)) {
            out.push(full);
        }
    }
    return out;
}

/** `SNAP_PEEK`를 CSS 길이로 환산하는 표현. 띄어쓰기·단위 변형을 함께 잡는다. */
const SNAP_AS_LENGTH =
    /SNAP_PEEK[^;\n]{0,40}(?:\*\s*100\s*(?:svh|dvh|vh)|\}\s*(?:svh|dvh|vh))/;

describe('모바일 시트 예약 높이', () => {
    it('예약 식이 실제 띠 공식과 같다', () => {
        // 띠 = 시트높이·svh − (1 − snap)·dvh. 식을 문자열로 그대로 확인한다 —
        // 값을 재계산해 비교하면 같은 실수를 두 번 하게 된다.
        expect(PEEK_RESERVE_CSS).toBe(
            `max(0px, calc(${SHEET_HEIGHT_SVH}svh - ${(1 - SNAP_PEEK) * 100}dvh))`
        );
        // 음수 방지 가드가 빠지면 띠가 0으로 수렴하는 구간에서 패딩이 음수가 된다.
        expect(PEEK_RESERVE_CSS.startsWith('max(0px,')).toBe(true);
        // 단위가 둘 다 등장해야 한다 — 하나로 통일하는 순간 어긋남이 돌아온다.
        expect(PEEK_RESERVE_CSS).toContain('svh');
        expect(PEEK_RESERVE_CSS).toContain('dvh');
    });

    it('시트 높이 상수가 실제 클래스와 일치한다', () => {
        // Tailwind는 정적 클래스만 스캔하므로 시트 쪽은 리터럴로 남는다.
        // 두 값이 갈리면 예약 식이 조용히 틀려진다.
        const sheet = readFileSync(
            path.join(VIEWS_DIR, 'MobileAnalysisSheet.tsx'),
            'utf8'
        );
        expect(sheet).toContain(`h-[${SHEET_HEIGHT_SVH}svh]`);
    });

    it('SNAP_PEEK를 CSS 길이로 환산하는 곳이 상수 모듈 하나뿐이다', () => {
        const files = sourceFiles(VIEWS_DIR);
        // 스캐너가 파일을 못 열면 위반 0건과 출력이 같아진다 — 분모를 남긴다.
        expect(files.length).toBeGreaterThan(10);

        // 상수 모듈은 **유일하게 정당한 자리**다. 여기서 한 번 식으로 만들고
        // 나머지는 그 결과(`PEEK_RESERVE_CSS`)를 받아 쓴다.
        const SOURCE_OF_TRUTH = path.join('constants', 'mobileSheet.ts');
        const offenders = files
            .filter(file => SNAP_AS_LENGTH.test(readFileSync(file, 'utf8')))
            .map(f => path.relative(VIEWS_DIR, f))
            .filter(rel => rel !== SOURCE_OF_TRUTH);
        expect(offenders).toEqual([]);

        // 그 한 자리가 사라지면 가드가 지킬 대상도 사라진 것이므로 함께 붙든다.
        const constantsSrc = readFileSync(
            path.join(VIEWS_DIR, SOURCE_OF_TRUTH),
            'utf8'
        );
        expect(SNAP_AS_LENGTH.test(constantsSrc)).toBe(true);
    });

    it('차트 컬럼은 예약 식을 CSS 변수로 받는다', () => {
        const src = readFileSync(
            path.join(VIEWS_DIR, 'ChartContent.tsx'),
            'utf8'
        );
        expect(src).toContain('PEEK_RESERVE_CSS');
        expect(src).toMatch(/pb-\[var\(--peek-reserve\)\]/);
        // 데스크톱에서는 시트가 없으므로 예약도 없어야 한다.
        expect(src).toContain('md:pb-0');
    });

    it('검출기가 실제로 잡는다', () => {
        for (const bad of [
            'style={{ \'--snap-peek\': SNAP_PEEK }} className="pb-[calc(var(--snap-peek)*100svh)]"',
            'paddingBottom: `${SNAP_PEEK * 100}svh`',
            'height: `${SNAP_PEEK*100 }dvh`',
        ]) {
            expect(SNAP_AS_LENGTH.test(bad)).toBe(true);
        }
        for (const good of [
            'const [snap, setSnap] = useState(SNAP_PEEK);',
            'onActiveSnapChange(SNAP_PEEK);',
            'PEEK_RESERVE_CSS',
        ]) {
            expect(SNAP_AS_LENGTH.test(good)).toBe(false);
        }
    });
});
