import { getTranslations } from 'next-intl/server';
import { METHODOLOGY_UPDATED_AT } from '@/shared/lib/legal';
import ko from '../../../../../messages/ko.json';
import en from '../../../../../messages/en.json';
import type { MethodologyTranslator } from '../../types';
import {
    METHODOLOGY_CHANGELOG,
    methodologyChangelogItems,
} from '../methodologyChangelog';

/** 페이지와 같은 `views.methodology` 번역기 — 테스트 설정이 로케일별 카탈로그를 연결한다. */
function translator(locale: 'ko' | 'en'): Promise<MethodologyTranslator> {
    return getTranslations({ locale, namespace: 'views.methodology' });
}

/** `YYYY-MM-DD`, 한국 날짜 — 변경 이력 표가 쓰는 형식과 같다. */
function kstDate(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

/**
 * 이력에 새 항목을 넣으면서 `METHODOLOGY_UPDATED_AT`을 안 올리면 화면의 "마지막
 * 업데이트"·JSON-LD `dateModified`·sitemap `lastmod`가 옛 날짜로 남는다. 둘은 사람이
 * 함께 올리는 값이라 여기서 묶는다.
 */
describe('METHODOLOGY_CHANGELOG', () => {
    it('최신 항목의 날짜가 METHODOLOGY_UPDATED_AT(한국 날짜)과 같다', () => {
        expect(METHODOLOGY_CHANGELOG[0]?.date).toBe(
            kstDate(METHODOLOGY_UPDATED_AT)
        );
    });

    it('최신순으로 정렬돼 있다', () => {
        const dates = METHODOLOGY_CHANGELOG.map(entry => entry.date);
        expect(dates).toEqual(dates.toSorted().toReversed());
    });
});

describe('methodologyChangelogItems', () => {
    it('resolves every entry in order with its catalog text and KST date', async () => {
        const items = methodologyChangelogItems(await translator('ko'), 'ko');
        expect(items.map(item => item.key)).toEqual(
            METHODOLOGY_CHANGELOG.map(entry => entry.key)
        );
        expect(items[0]).toEqual({
            key: 'fearGreedFiveYears',
            date: '2026-10-05',
            label: '2026년 10월 5일',
            text: ko.views.methodology.changelog.fearGreedFiveYears,
        });
        expect(items.at(-1)).toEqual({
            key: 'aboutPublished',
            date: '2026-09-11',
            label: '2026년 9월 11일',
            text: ko.views.methodology.changelog.aboutPublished,
        });
    });

    it('formats the date label for the locale without shifting the KST day', async () => {
        const items = methodologyChangelogItems(await translator('en'), 'en');
        expect(items[0]?.label).toBe('October 5, 2026');
        expect(items[0]?.text).toBe(
            en.views.methodology.changelog.fearGreedFiveYears
        );
    });
});
