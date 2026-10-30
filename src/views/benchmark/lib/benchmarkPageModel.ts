/**
 * 벤치마크 본문(서버)이 그리는 값 모델 — 헤드라인 비교표와 방법론 문구에 넣는 값.
 */
import {
    BENCHMARK_SIGNIFICANCE_LEVEL,
    buildBenchmarkHeadline,
    withSubjectLabel,
    type BenchmarkContrastVerdict,
    type BenchmarkHeadlineEntry,
} from '@/entities/benchmark/lib/benchmarkHeadline';
import type { BenchmarkRelease } from '@/entities/benchmark/types';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { formatBenchmarkContrast } from '@/shared/lib/benchmarkFormat';

/** 헤드라인 비교표 한 줄 — 표에 찍을 문자열까지 만든 값. */
export interface BenchmarkHeadlineRow {
    readonly id: string;
    readonly label: string;
    readonly diffText: string;
    readonly ciText: string;
    readonly pText: string;
    /** 비교에 쓴 문항 수. */
    readonly n: number;
    readonly verdict: BenchmarkContrastVerdict;
}

/** 헤드라인 비교표 하나(경쟁 모델 또는 기준선). 비어 있는 묶음은 모델에 싣지 않는다. */
export interface BenchmarkHeadlineGroup {
    readonly key: 'competitors' | 'baselines';
    readonly rows: readonly BenchmarkHeadlineRow[];
}

/** 헤드라인 문장에 넣는 값. */
export interface BenchmarkHeadlineSummary {
    readonly subject: string;
    /** 비교한 경쟁 모델 수. */
    readonly count: number;
    readonly ahead: number;
    readonly tie: number;
    readonly behind: number;
}

/** 헤드라인 구역이 그리는 값. 비교 주체가 데이터에 없으면 모델 자체가 null이다. */
export interface BenchmarkHeadlineModel {
    readonly summary: BenchmarkHeadlineSummary;
    readonly groups: readonly BenchmarkHeadlineGroup[];
    /** 앞섬·뒤처짐을 가르는 Holm p 유의 수준. 주석 문장에 그대로 찍는다. */
    readonly significanceLevel: number;
}

/** 벤치마크 본문이 그리는 값 — 주체 이름을 바꾼 릴리스와 그로부터 만든 헤드라인. */
export interface BenchmarkPageModel {
    /** 주체 라벨을 브랜드 표기로 바꾼 릴리스. 화면의 모든 표가 이것을 읽는다. */
    readonly release: BenchmarkRelease;
    readonly headline: BenchmarkHeadlineModel | null;
}

function toHeadlineRow(entry: BenchmarkHeadlineEntry): BenchmarkHeadlineRow {
    return {
        id: entry.target.id,
        label: entry.target.label,
        ...formatBenchmarkContrast(entry.contrast),
        n: entry.contrast.n,
        verdict: entry.verdict,
    };
}

/**
 * 본문 모델. 판정(앞섬·동률·뒤처짐)은 entity의 `buildBenchmarkHeadline`이 정하고 여기서는
 * 화면 모양으로 옮기기만 한다 — 화면 컴포넌트가 entity `lib/`를 직접 부르지 않게 한다.
 * 주체는 화면 어디서나 브랜드 표기로 부른다(경쟁 모델은 데이터 라벨 그대로).
 */
export function buildBenchmarkPageModel(
    rawRelease: BenchmarkRelease,
    subjectLabel: string
): BenchmarkPageModel {
    const release = withSubjectLabel(rawRelease, subjectLabel);
    const headline = buildBenchmarkHeadline(release);
    if (headline === null) return { release, headline: null };
    const groups: readonly BenchmarkHeadlineGroup[] = [
        { key: 'competitors', rows: headline.competitors.map(toHeadlineRow) },
        { key: 'baselines', rows: headline.baselines.map(toHeadlineRow) },
    ];
    return {
        release,
        headline: {
            summary: {
                subject: headline.subject.label,
                count: headline.competitors.length,
                ahead: headline.counts.ahead,
                tie: headline.counts.tie,
                behind: headline.counts.behind,
            },
            groups: groups.filter(group => group.rows.length > 0),
            significanceLevel: BENCHMARK_SIGNIFICANCE_LEVEL,
        },
    };
}

interface PoolSummaryFormatters {
    readonly count: Intl.NumberFormat;
    readonly list: Intl.ListFormat;
}

/** `Intl` 포맷터 생성은 로케일 데이터를 조회해 싸지 않다 — 로케일이 4개뿐이라 모듈에 캐시한다. */
const POOL_SUMMARY_FORMATTERS = new Map<Locale, PoolSummaryFormatters>();

function poolSummaryFormatters(locale: Locale): PoolSummaryFormatters {
    const cached = POOL_SUMMARY_FORMATTERS.get(locale);
    if (cached) return cached;
    const intlLocale = INTL_LOCALE[locale];
    const created: PoolSummaryFormatters = {
        count: new Intl.NumberFormat(intlLocale),
        list: new Intl.ListFormat(intlLocale, {
            style: 'long',
            type: 'conjunction',
        }),
    };
    POOL_SUMMARY_FORMATTERS.set(locale, created);
    return created;
}

/**
 * 풀별 문항 수 요약(`primary 119, aux 16 및 L5 30`). 구분자와 접속사는 `Intl.ListFormat`이
 * 로케일에 맞춰 정한다 — 쉼표를 손으로 이으면 ja·zh 문장에 라틴 쉼표가 박힌다.
 */
export function formatBenchmarkPoolSummary(
    poolSizes: Readonly<Record<string, number>>,
    locale: Locale
): string {
    const { count, list } = poolSummaryFormatters(locale);
    return list.format(
        Object.entries(poolSizes).map(
            ([pool, size]) => `${pool} ${count.format(size)}`
        )
    );
}
