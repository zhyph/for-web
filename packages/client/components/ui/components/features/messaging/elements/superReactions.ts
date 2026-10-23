/**
 * Super reactions (Nitro parity fork, see NITRO.md) are ordinary reactions stored under "super:<emoji>",
 * which the SDK and backend carry through unchanged.
 */
export const SUPER_PREFIX = "super:";

export const isSuperReaction = (key: string) => key.startsWith(SUPER_PREFIX);

/** The emoji a reaction key shows */
export const reactionEmoji = (key: string) =>
  isSuperReaction(key) ? key.slice(SUPER_PREFIX.length) : key;

// Shift held while picking an emoji or clicking a reaction makes it a super reaction
let shiftHeld = false;
window.addEventListener("keydown", (e) => {
  if (e.key === "Shift") shiftHeld = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "Shift") shiftHeld = false;
});
window.addEventListener("blur", () => (shiftHeld = false));

export const isShiftHeld = () => shiftHeld;

/** Pop-and-glow burst played when a super reaction appears or gains a reactor */
export function burst(el: HTMLElement) {
  el.animate(
    [
      { transform: "scale(0.6)", filter: "brightness(2.2) saturate(1.6)" },
      { transform: "scale(1.18)", offset: 0.45 },
      { transform: "scale(1)", filter: "none" },
    ],
    { duration: 650, easing: "cubic-bezier(.2,1.4,.4,1)" },
  );
}
