// Whether a key press is someone typing in a text box (so board shortcuts should stay out of the way).
export const isTyping = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea')
