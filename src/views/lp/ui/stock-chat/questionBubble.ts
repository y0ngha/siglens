/**
 * Class for a user's question drawn as a chat bubble on `/lp/stock-chat`.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/** The example-question list items and the flow's opening question share it. */
export const QUESTION_BUBBLE = cn(
    SURFACE_CARD,
    'max-w-sm px-4 py-2.5 text-sm text-secondary-100'
);
