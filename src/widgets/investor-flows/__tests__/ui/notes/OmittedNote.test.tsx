// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OmittedNote } from '../../../ui/notes/OmittedNote';

describe('OmittedNote', () => {
    it('호출부가 넘긴 문장을 작은 안내 문단으로 보인다', () => {
        render(<OmittedNote>상한 때문에 3건을 뺐어요.</OmittedNote>);
        const note = screen.getByText('상한 때문에 3건을 뺐어요.');
        expect(note.tagName).toBe('P');
        expect(note).toHaveClass('text-xs');
    });
});
