'use client';

/**
 * 캘린더 국가 코드 → 로케일 국가 이름 훅(빈 상태 문구용).
 */
import { useTranslations } from 'next-intl';
import { CALENDAR_COUNTRY_LABEL_KEY } from '@/entities/economy/lib/economyCalendarConstants';
import type { CalendarCountry } from '@/entities/economy/model';

/** 국가 코드의 화면 이름 — 키 매핑은 entity 상수가, 번역은 이 훅이 한다. */
export function useCalendarCountryLabel(country: CalendarCountry): string {
    const tCountry = useTranslations('entities.economy.calendarCountry');
    return tCountry(CALENDAR_COUNTRY_LABEL_KEY[country]);
}
