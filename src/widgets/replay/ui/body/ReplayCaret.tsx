/**
 * The block caret at the end of typed or streamed text. Decorative (hidden from assistive tech),
 * and it only blinks when motion is allowed, so under reduced motion it never draws the eye.
 */
export function ReplayCaret() {
    return (
        <span
            aria-hidden="true"
            className="ml-px inline-block h-[1em] w-[7px] translate-y-[2px] bg-secondary-300 motion-safe:animate-pulse"
        />
    );
}
