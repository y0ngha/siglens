/**
 * `/methodology` 변경 이력의 데이터와, 화면에 그릴 한 줄로 푸는 함수.
 *
 * 문구는 `views.methodology.changelog.<key>` 카탈로그 키라 4개 로케일이 같은
 * 이력을 가진다. 날짜는 한국 날짜(`YYYY-MM-DD`)로 고정한다 — 운영자가 한국에서
 * 그날 한 일을 적는 표라, 로케일에 따라 하루가 밀리면 이력이 틀어진다.
 */
import type { Locale } from '@/shared/i18n/locales';
import { formatKoreanDate } from '@/shared/lib/legal';
import type { MethodologyTranslator } from '../types';

/** 이력 한 줄의 카탈로그 키(`views.methodology.changelog.<key>`). */
export type MethodologyChangelogKey =
    | 'fearGreedFiveYears'
    | 'methodologyPublished'
    | 'indexableTabs'
    | 'crawlerParity'
    | 'aboutRewritten'
    | 'aboutPublished';

/** 이력 한 줄의 원천 데이터. */
export interface MethodologyChangelogEntry {
    /** `YYYY-MM-DD`, 한국 날짜. */
    readonly date: string;
    readonly key: MethodologyChangelogKey;
}

/**
 * 최신순. 새 항목은 **맨 앞**에 넣는다.
 *
 * 날짜는 각 변경이 실제로 들어간 커밋의 날짜다. 이 배열을 고치면
 * `METHODOLOGY_UPDATED_AT`(`shared/lib/legal.ts`)도 함께 올린다 — 화면의
 * "마지막 업데이트"·JSON-LD `dateModified`·sitemap `lastmod`가 그 값을 읽는다.
 * 새 키는 [[methodologyChangelogItems]]의 문구 표에도 넣어야 타입이 통과한다.
 */
export const METHODOLOGY_CHANGELOG: readonly MethodologyChangelogEntry[] = [
    { date: '2026-10-05', key: 'fearGreedFiveYears' },
    { date: '2026-10-04', key: 'methodologyPublished' },
    { date: '2026-10-01', key: 'indexableTabs' },
    { date: '2026-09-27', key: 'crawlerParity' },
    { date: '2026-09-24', key: 'aboutRewritten' },
    { date: '2026-09-11', key: 'aboutPublished' },
];

/** 화면에 그릴 이력 한 줄. */
export interface MethodologyChangelogItem {
    readonly key: MethodologyChangelogKey;
    /** `<time dateTime>`에 그대로 싣는 `YYYY-MM-DD`. */
    readonly date: string;
    /** 로케일에 맞춘 날짜 표기(한국 날짜 기준). */
    readonly label: string;
    readonly text: string;
}

/**
 * [[METHODOLOGY_CHANGELOG]]를 순서 그대로 화면용 줄로 푼다.
 *
 * 문구는 키마다 리터럴 `t('changelog.…')`로 부른다 — 카탈로그 스캔이 키를 직접
 * 찾으므로 `manualKeys.json` 등록 없이도 재생성 때 지워지지 않고, 키를 빠뜨리면
 * `Record`가 타입 오류로 잡는다.
 */
export function methodologyChangelogItems(
    t: MethodologyTranslator,
    locale: Locale
): readonly MethodologyChangelogItem[] {
    const text: Readonly<Record<MethodologyChangelogKey, string>> = {
        fearGreedFiveYears: t('changelog.fearGreedFiveYears'),
        methodologyPublished: t('changelog.methodologyPublished'),
        indexableTabs: t('changelog.indexableTabs'),
        crawlerParity: t('changelog.crawlerParity'),
        aboutRewritten: t('changelog.aboutRewritten'),
        aboutPublished: t('changelog.aboutPublished'),
    };
    return METHODOLOGY_CHANGELOG.map(entry => ({
        key: entry.key,
        date: entry.date,
        label: formatKoreanDate(
            new Date(`${entry.date}T00:00:00+09:00`),
            locale
        ),
        text: text[entry.key],
    }));
}
