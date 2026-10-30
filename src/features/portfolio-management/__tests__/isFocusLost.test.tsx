import { isFocusLost } from '@/features/portfolio-management/lib/isFocusLost';

describe('isFocusLost', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('is true when nothing but <body> holds focus', () => {
        expect(isFocusLost()).toBe(true);
    });

    it('is false when a control holds focus', () => {
        const button = document.createElement('button');
        document.body.append(button);
        button.focus();

        expect(isFocusLost()).toBe(false);
    });

    it('is true after the focused control is removed from the DOM', () => {
        const button = document.createElement('button');
        document.body.append(button);
        button.focus();
        button.remove();

        expect(isFocusLost()).toBe(true);
    });
});
