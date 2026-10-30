// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShortVolumeBlock } from '../../sections/ShortVolumeBlock';
import { buildShortVolumeSeries } from '../../utils/short';

describe('ShortVolumeBlock 평균 캡션', () => {
    it('평균에 실제로 들어간 거래일 수를 말한다 — 비중을 계산할 수 없던 날은 세지 않는다', () => {
        const series = buildShortVolumeSeries([
            { date: '2026-10-13', shortVolume: 0, totalVolume: 0 },
            { date: '2026-10-14', shortVolume: 4, totalVolume: 10 },
            { date: '2026-10-15', shortVolume: 6, totalVolume: 10 },
        ]);
        render(<ShortVolumeBlock series={series} marker={null} />);
        expect(series.rows).toHaveLength(3);
        expect(
            screen.getByText('점선은 최근 2거래일 평균 50.0%예요.')
        ).toBeInTheDocument();
    });
});
