import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    SCAN_TIMEOUT_MS,
    controlOpeningTags,
    sourceFiles,
} from './support/controlUsage';
import { blankComments } from './support/sourceScan';

/**
 * 차트는 테마가 바뀌면 **마운트 지점에서 remount**돼야 한다.
 *
 * 왜 이런 형태인가: lightweight-charts 시리즈는 생성 시점에 받은 색을 들고
 * 있어서, `CHART_COLORS`가 테마를 보는 게터가 되어도 이미 그려진 차트는
 * 바뀌지 않는다. 처음에는 차트 **생성 효과**의 deps에 테마 버전을 넣었는데,
 * 그러면 차트만 다시 만들어지고 `setData`를 부르는 효과와 오버레이 훅 31개는
 * 안정적인 ref에만 의존해 재실행되지 않는다 — **토글 한 번에 차트가 백지가
 * 됐다**(감사 실증: createChart 2회 대 setData 1회, 크롬에서 캔들·거래량·축이
 * 전부 사라지고 새로고침해야 복구). 지표 색이 틀린 것보다 차트가 없는 쪽이
 * 훨씬 나쁘다.
 *
 * `key`로 갈면 그 훅들이 전부 함께 다시 돌아 새 팔레트로 그린다. 그래서
 * 규약은 "차트 컴포넌트를 렌더하는 곳은 `key={themeVersion}`을 준다"이다.
 *
 * 이 가드가 지키는 것: 그 `key`는 **지워도 타입·린트·테스트가 전부 초록인**
 * 종류의 코드다. 실제로 감사가 테마 배선 전체를 삭제하고 10,484건 전부
 * 통과하는 것을 보여줬다. 동작 자체는 `StockChart.test.tsx`의
 * "테마가 바뀌면 차트를 데이터까지 다시 그린다"가 보고, 여기서는 **실제
 * 마운트 지점**이 그 패턴을 쓰는지를 본다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

/** lightweight-charts 인스턴스를 만드는 컴포넌트들. */
const CHART_COMPONENTS = [
    'StockChart',
    'VolumeChart',
    'ShareCandlestickChart',
    'FearGreedHistoricalChart',
] as const;

interface MountSite {
    file: string;
    line: number;
    component: string;
    hasKey: boolean;
}

function mountSites(): MountSite[] {
    const out: MountSite[] = [];
    for (const file of sourceFiles(SRC_DIR, ['.tsx'])) {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        const source = blankComments(readFileSync(file, 'utf8'));
        for (const component of CHART_COMPONENTS) {
            // 자기 자신의 정의 파일은 마운트 지점이 아니다.
            if (path.basename(file) === `${component}.tsx`) continue;
            for (const { tag, index } of controlOpeningTags(
                source,
                component
            )) {
                out.push({
                    file: path.relative(SRC_DIR, file),
                    line: source.slice(0, index).split('\n').length,
                    component,
                    hasKey: /\bkey=\{themeVersion\}/.test(tag),
                });
            }
        }
    }
    return out.sort((a, b) => a.file.localeCompare(b.file));
}

describe('chart theme remount guard', { timeout: SCAN_TIMEOUT_MS }, () => {
    it('차트 마운트 지점이 테마 버전으로 remount된다', () => {
        const sites = mountSites();
        // 스캐너가 아무것도 못 찾았는데 통과하는 일이 없도록 분모를 고정한다.
        // 차트 마운트 지점이 늘거나 줄면 이 수를 함께 고쳐야 하고, 그때
        // 새 지점이 규약을 지키는지 보게 된다.
        expect(sites.length).toBeGreaterThanOrEqual(4);
        expect(sites.filter(s => !s.hasKey)).toEqual([]);
    });

    it('마운트 지점 파일이 훅을 실제로 부른다', () => {
        const files = [...new Set(mountSites().map(s => s.file))];
        const missing = files.filter(rel => {
            const source = readFileSync(path.join(SRC_DIR, rel), 'utf8');
            return !/const\s+themeVersion\s*=\s*useThemeVersion\(\)/.test(
                source
            );
        });
        expect(missing).toEqual([]);
    });

    it('검출기가 실제로 잡는다', () => {
        const withKey = controlOpeningTags(
            '<StockChart key={themeVersion} bars={b} />',
            'StockChart'
        )[0];
        const withoutKey = controlOpeningTags(
            '<StockChart bars={b} />',
            'StockChart'
        )[0];
        expect(/\bkey=\{themeVersion\}/.test(withKey.tag)).toBe(true);
        expect(/\bkey=\{themeVersion\}/.test(withoutKey.tag)).toBe(false);
    });
});
