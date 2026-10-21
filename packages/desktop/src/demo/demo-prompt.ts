import { reviewScript } from "./review-script.js";

const TYPING_DELAY_MS = 45;
const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;

function write(textarea: HTMLTextAreaElement, value: string) {
  setValue?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

async function type(textarea: HTMLTextAreaElement, text: string) {
  for (let length = 1; length <= text.length; length += 1) {
    await new Promise((resolve) => setTimeout(resolve, TYPING_DELAY_MS + Math.random() * 40));
    if (textarea.value !== text.slice(0, length - 1)) return;
    write(textarea, text.slice(0, length));
  }
}

// Types the demo prompt, in the chosen app language, the first time an empty composer is focused.
export function prefillComposerOnFocus() {
  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement) || target.closest(".composer") === null) return;
    if (target.value !== "") return;
    void type(target, reviewScript().prompt);
  });
}
