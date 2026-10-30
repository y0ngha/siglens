import { renderHook } from '@testing-library/react';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { useCalendarCountryLabel } from '@/widgets/economy/hooks/useCalendarCountryLabel';
import koMessages from '../../../../../messages/ko.json';

describe('useCalendarCountryLabel', () => {
    it('국가 코드를 실제 카탈로그 국가 이름으로 바꾼다', () => {
        const { result } = renderHook(() => useCalendarCountryLabel('KR'), {
            wrapper: IntlTestProvider,
        });
        expect(result.current).toBe(
            koMessages.entities.economy.calendarCountry.KR
        );
    });
});
