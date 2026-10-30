// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OutsideWindowGroup } from '../../../ui/insider/OutsideWindowGroup';
import { makeTransaction } from '../../fixtures/flowsFixtures';

describe('OutsideWindowGroup', () => {
    it('제목·요약에 세지 않는다는 안내·거래 목록을 함께 보인다', () => {
        render(
            <OutsideWindowGroup
                title="점수 창 시작(2026-07-19) 전 거래"
                rows={[makeTransaction({ name: 'Fixture Director A' })]}
            />
        );
        expect(
            screen.getByRole('heading', {
                name: '점수 창 시작(2026-07-19) 전 거래',
            })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '위 요약의 건수와 금액에는 들어가지 않은 거래예요.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getAllByText('Fixture Director A').length
        ).toBeGreaterThan(0);
    });

    it('제목을 표 캡션으로도 쓴다', () => {
        render(
            <OutsideWindowGroup
                title="점수 창 종료 후 거래"
                rows={[makeTransaction()]}
            />
        );
        expect(
            screen.getByRole('table', { name: '점수 창 종료 후 거래' })
        ).toBeInTheDocument();
    });
});
