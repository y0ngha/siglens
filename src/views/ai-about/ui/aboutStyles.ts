/**
 * Class bundles shared by more than one `/about` section.
 */
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';

/**
 * The page's own "open the chat" buttons (hero and closing card). The ring
 * offset matches the page background so the focus ring keeps its contrast
 * against the primary fill.
 */
export const ABOUT_PRIMARY_BUTTON = cn(
    BUTTON_PRIMARY,
    'min-h-11 px-6 text-sm focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900'
);
