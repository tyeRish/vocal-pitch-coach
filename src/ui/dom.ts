// Tiny DOM helpers — no framework needed.

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k in el && !k.includes('-')) (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element, ...children: Child[]) {
  el.replaceChildren();
  append(el, children);
}

let toastHost: HTMLElement | null = null;
const toastListeners = new Set<(msg: string) => void>();

export function onToast(fn: (msg: string) => void) { toastListeners.add(fn); return () => toastListeners.delete(fn); }

export function toast(msg: string, kind: 'info' | 'warn' = 'info') {
  if (!toastHost) {
    toastHost = h('div', { class: 'toasts' });
    document.body.append(toastHost);
  }
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastHost.append(t);
  setTimeout(() => t.classList.add('gone'), 4500);
  setTimeout(() => t.remove(), 5000);
  toastListeners.forEach((fn) => fn(msg));
}

export const fmtMin = (sec: number) => (sec < 60 ? `${Math.round(sec)}s` : `${Math.round(sec / 60)} min`);
