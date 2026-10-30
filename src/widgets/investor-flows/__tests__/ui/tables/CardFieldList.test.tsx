// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardFieldList } from '../../../ui/tables/CardFieldList';

describe('CardFieldList', () => {
    it('라벨은 dt, 값은 dd로 짝지어 보인다', () => {
        render(
            <CardFieldList
                fields={[
                    { label: '날짜', value: '2026-10-10' },
                    { label: '수량', value: '4,000' },
                ]}
            />
        );
        expect(screen.getByText('날짜').tagName).toBe('DT');
        expect(screen.getByText('2026-10-10').tagName).toBe('DD');
        expect(screen.getByText('수량').tagName).toBe('DT');
        expect(screen.getByText('4,000').tagName).toBe('DD');
    });

    it('mono가 켜진 필드만 고정폭 글꼴을 쓴다', () => {
        render(
            <CardFieldList
                fields={[
                    { label: '날짜', value: '2026-10-10', mono: true },
                    { label: '수량', value: '4,000' },
                ]}
            />
        );
        expect(screen.getByText('2026-10-10')).toHaveClass('font-mono');
        expect(screen.getByText('4,000')).not.toHaveClass('font-mono');
    });

    it('값에 노드를 그대로 넣을 수 있다', () => {
        render(
            <CardFieldList
                fields={[{ label: '링크', value: <a href="#x">원문</a> }]}
            />
        );
        expect(screen.getByRole('link', { name: '원문' })).toBeInTheDocument();
    });
});
