// Spoken coaching for hands-free (Drive Mode) sessions.

let enabled = true;

export const speech = {
  get supported() { return 'speechSynthesis' in window; },
  setEnabled(on: boolean) { enabled = on; if (!on) this.cancel(); },

  /** Speak and resolve when finished (or after a timeout, since some browsers never fire onend). */
  say(text: string): Promise<void> {
    if (!enabled || !this.supported) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      window.setTimeout(finish, 1500 + text.length * 90);
      window.speechSynthesis.speak(u);
    });
  },

  cancel() {
    if (this.supported) window.speechSynthesis.cancel();
  },
};
