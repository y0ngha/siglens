/**
 * `/methodology` 변경 이력의 한 줄.
 *
 * 문구는 `views.methodology.changelog.<key>` 카탈로그 키라 4개 로케일이 같은
 * 이력을 가진다. 날짜는 한국 날짜(`YYYY-MM-DD`)로 고정한다 — 운영자가 한국에서
 * 그날 한 일을 적는 표라, 로케일에 따라 하루가 밀리면 이력이 틀어진다.
 */
export type MethodologyChangelogKey =
    | 'methodologyPublished'
    | 'indexableTabs'
    | 'crawlerParity'
    | 'aboutRewritten'
    | 'aboutPublished';

export interface MethodologyChangelogEntry {
    /** `YYYY-MM-DD`, 한국 날짜. */
    readonly date: string;
    readonly key: MethodologyChangelogKey;
}

/**
 * 최신순. 새 항목은 **맨 앞**에 넣는다.
 *
 * 날짜는 각 변경이 실제로 들어간 커밋의 날짜다(`git log`로 확인):
 * 분석 방법 페이지 2026-10-04, 색인 탭 축소와 템플릿 FAQ 제거(#898) 2026-10-01,
 * 봇 분기 제거(#882) 2026-09-27, `/about` 재구성 2026-09-24, `/about` 최초 공개
 * 2026-09-11. 이 배열을 고치면 `METHODOLOGY_UPDATED_AT`(`shared/lib/legal.ts`)도
 * 함께 올린다 — 화면의 "마지막 업데이트"·JSON-LD `dateModified`·sitemap `lastmod`가
 * 그 값을 읽는다.
 *
 * `views.methodology.changelog`는 `manualKeys.json`의 `preserve`에 등록돼 있다 —
 * 키를 `t('...')` 리터럴로 부르지 않고 이 배열로 조회하므로, 등록이 없으면
 * `i18n:extract --write`가 그 키들을 지운다.
 */
export const METHODOLOGY_CHANGELOG: readonly MethodologyChangelogEntry[] = [
    { date: '2026-10-04', key: 'methodologyPublished' },
    { date: '2026-10-01', key: 'indexableTabs' },
    { date: '2026-09-27', key: 'crawlerParity' },
    { date: '2026-09-24', key: 'aboutRewritten' },
    { date: '2026-09-11', key: 'aboutPublished' },
];
