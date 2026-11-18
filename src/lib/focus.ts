/**
 * Whether a form that just opened should put the cursor in its first field.
 * Only with a mouse: on a phone that pops the keyboard over the rest of the
 * form (the list kinds, the icons) before the user asked to type.
 */
export function focusOnOpen() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}
