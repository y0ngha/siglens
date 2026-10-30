import { focusHoldingErrorField } from '@/features/portfolio-management/lib/focusHoldingErrorField';

function setUp() {
    const symbolField = document.createElement('div');
    const symbolInput = document.createElement('input');
    symbolField.append(symbolInput);
    const quantity = document.createElement('input');
    const averagePrice = document.createElement('input');
    const other = document.createElement('button');
    document.body.append(symbolField, quantity, averagePrice, other);
    other.focus();
    return { symbolField, symbolInput, quantity, averagePrice, other };
}

describe('focusHoldingErrorField', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('focuses the quantity input', () => {
        const els = setUp();
        focusHoldingErrorField('quantity', els);
        expect(document.activeElement).toBe(els.quantity);
    });

    it('focuses the average price input', () => {
        const els = setUp();
        focusHoldingErrorField('averagePrice', els);
        expect(document.activeElement).toBe(els.averagePrice);
    });

    it('focuses the first control inside the symbol field', () => {
        const els = setUp();
        focusHoldingErrorField('symbol', els);
        expect(document.activeElement).toBe(els.symbolInput);
    });

    it('leaves focus alone when the symbol field has no control (edit mode)', () => {
        const els = setUp();
        els.symbolInput.remove();
        focusHoldingErrorField('symbol', els);
        expect(document.activeElement).toBe(els.other);
    });

    it('leaves focus alone for an error with no field', () => {
        const els = setUp();
        focusHoldingErrorField(null, els);
        expect(document.activeElement).toBe(els.other);
    });
});
