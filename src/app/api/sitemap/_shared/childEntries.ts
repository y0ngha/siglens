import 'server-only';
import { backtestingDataDate } from '@/entities/sitemap-entry/lib/backtestingDataDate';
import { buildCryptoPopularEntries } from '@/entities/sitemap-entry/lib/buildCryptoPopularEntries';
import { buildPopularEntries } from '@/entities/sitemap-entry/lib/buildPopularEntries';
import { buildStaticEntries } from '@/entities/sitemap-entry/lib/buildStaticEntries';
import type { SitemapEntry } from '@/entities/sitemap-entry/model';
import {
    loadPopularSitemapInputs,
    loadStaticSitemapInputs,
} from '@/entities/sitemap-entry/server';
import { validateBacktestData } from '@/entities/backtest-case/lib/validate';
import backtestData from '@/app/[locale]/backtesting/data.json';

/**
 * 자식 sitemap(static/popular/crypto)의 엔트리 목록을 만드는 **유일한** 경로.
 *
 * 자식 라우트는 이 결과를 XML로 내보내고, 인덱스(`/api/sitemap`)는 같은 결과의 최댓값을
 * 자식의 `lastmod`로 광고한다. 두 쪽이 입력을 각자 조립하면(예: 인덱스만 산문 게이트나
 * 백테스팅 데이터일을 빠뜨리면) 인덱스가 자식 파일에 존재하지 않는 엔트리의 시각을
 * 광고하게 된다 — 그래서 입력 로딩과 빌드를 한 함수로 묶는다. 입력 로더는
 * `unstable_cache`라 인덱스·자식이 같은 캐시 항목을 공유한다.
 */
export async function loadStaticChildEntries(
    now: Date
): Promise<SitemapEntry[]> {
    const inputs = await loadStaticSitemapInputs();
    return buildStaticEntries(now, {
        ...inputs,
        // 화면이 쓰는 것과 같은 파생값 — `/backtesting` 본문은 이 정적 데이터가
        // 전부라 마지막 케이스 진입일이 곧 콘텐츠 갱신 시각이다.
        backtestingDataDate: backtestingDataDate(
            validateBacktestData(backtestData).cases
        ),
    });
}

export async function loadPopularChildEntries(
    now: Date
): Promise<SitemapEntry[]> {
    return buildPopularEntries(now, await loadPopularSitemapInputs());
}

export async function loadCryptoChildEntries(
    now: Date
): Promise<SitemapEntry[]> {
    return buildCryptoPopularEntries(now, await loadPopularSitemapInputs());
}
