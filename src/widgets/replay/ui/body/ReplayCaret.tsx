/** The blinking block caret at the end of typed or streamed text (decorative). */

/** Decorative caret; still under reduced motion, so it never draws the eye. */
export function ReplayCaret() {
    return (
        <span
            aria-hidden="true"
            className="ml-px inline-block h-[1em] w-[7px] translate-y-[2px] bg-secondary-300 motion-safe:animate-pulse"
        />
    );
}
