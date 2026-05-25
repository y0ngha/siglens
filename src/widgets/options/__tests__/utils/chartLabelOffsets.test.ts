import {
    PEAK_LABEL_TOP_OFFSET_PX,
    CALL_LABEL_MIDLINE_OFFSET_PX,
    PUT_LABEL_MIDLINE_OFFSET_PX,
} from '@/widgets/options/utils/chartLabelOffsets';

describe('chartLabelOffsets', () => {
    it('exports PEAK_LABEL_TOP_OFFSET_PX as a positive number', () => {
        expect(PEAK_LABEL_TOP_OFFSET_PX).toBeGreaterThan(0);
    });

    it('exports CALL_LABEL_MIDLINE_OFFSET_PX as a positive number', () => {
        expect(CALL_LABEL_MIDLINE_OFFSET_PX).toBeGreaterThan(0);
    });

    it('exports PUT_LABEL_MIDLINE_OFFSET_PX as a positive number', () => {
        expect(PUT_LABEL_MIDLINE_OFFSET_PX).toBeGreaterThan(0);
    });

    it('Put offset is larger than Call offset to avoid overlap', () => {
        expect(PUT_LABEL_MIDLINE_OFFSET_PX).toBeGreaterThan(
            CALL_LABEL_MIDLINE_OFFSET_PX
        );
    });
});
