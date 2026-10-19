import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { engine } from './audio/engine';
import { speech } from './audio/speech';
import { store } from './data/store';
import { initSession } from './session';
import { h, toast } from './ui/dom';
import { mountCoach } from './views/coach';
import { mountZone } from './views/zone';
import { mountTrain } from './views/train';
import { mountLab } from './views/lab';
import { mountDrive } from './views/drive';
import { mountMore } from './views/more';

const VIEWS: Record<string, { label: string; icon: string; mount: (root: HTMLElement) => () => void }> = {
  coach: { label: 'Coach', icon: '🎤', mount: mountCoach },
  zone: { label: 'Zone', icon: '🎯', mount: mountZone },
  train: { label: 'Train', icon: '🎵', mount: mountTrain },
  lab: { label: 'Lab', icon: '🔥', mount: mountLab },
  drive: { label: 'Drive', icon: '🚗', mount: mountDrive },
  more: { label: 'More', icon: '📈', mount: mountMore },
};

registerSW({ immediate: true });
initSession();
speech.setEnabled(store.settings.voiceCues);

const main = document.getElementById('view')!;
const nav = document.getElementById('tabs')!;
const status = document.getElementById('mic-status')!;
let unmount: (() => void) | null = null;

for (const [id, v] of Object.entries(VIEWS)) {
  nav.append(h('a', { href: `#${id}`, 'data-view': id }, h('span', { class: 'icon' }, v.icon), h('span', {}, v.label)));
}

function route() {
  let id = location.hash.slice(1);
  if (!VIEWS[id]) id = store.profile.range ? 'coach' : 'zone';
  unmount?.();
  main.replaceChildren();
  unmount = VIEWS[id].mount(main);
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.view === id));
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

engine.onStatus((on) => {
  status.textContent = on ? '● LIVE' : '○ mic off';
  status.classList.toggle('live', on);
});

if (!window.isSecureContext || !navigator.mediaDevices) {
  toast('The microphone needs a secure (https) connection. Open the GitHub Pages link or use "npm run phone".', 'warn');
}
