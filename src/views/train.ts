// Training: the exercise library and the guided daily workout.

import { store } from '../data/store';
import { byId, CATEGORY_LABELS, EXERCISES, WORKOUTS, type Category, type Exercise } from '../data/exercises';
import { clear, h } from '../ui/dom';
import { exercisePlayer } from './shared';

export function exerciseList(categories: Category[], open: (ex: Exercise) => void) {
  return categories.map((cat) =>
    h('div', { class: 'card' },
      h('h3', {}, CATEGORY_LABELS[cat]),
      h('div', { class: 'ex-list' },
        ...EXERCISES.filter((e) => e.category === cat).map((ex) => {
          const best = store.best(ex.id);
          return h('button', { class: 'ex-item', onclick: () => open(ex) },
            h('div', {}, h('strong', {}, ex.name), h('small', {}, ex.summary)),
            h('span', { class: 'best' }, best !== null ? `${best}%` : '›'),
          );
        }),
      ),
    ));
}

export function mountTrain(root: HTMLElement) {
  const view = h('section', { class: 'view train' });
  root.append(view);
  let destroy: (() => void) | null = null;

  const home = () => {
    destroy?.();
    destroy = null;
    clear(view,
      h('div', { class: 'card hero' },
        h('h2', {}, 'Daily workout'),
        h('p', {}, 'Warm-up → pitch → Freddie power → fry → grit → scream → cool-down. About 12 minutes, all in your zone.'),
        h('button', { class: 'btn primary big', onclick: () => play(WORKOUTS.daily, 0) }, '▶ Start daily workout'),
      ),
      ...exerciseList(['warmup', 'pitch', 'power', 'cooldown'], (ex) => play([ex.id], 0)),
      h('p', { class: 'muted center' }, 'Fry, grit, scream and growl exercises live in the Lab tab.'),
    );
  };

  const play = (ids: string[], i: number) => {
    destroy?.();
    const p = exercisePlayer(byId(ids[i]), {
      onBack: home,
      onNext: i + 1 < ids.length ? () => play(ids, i + 1) : undefined,
    });
    destroy = p.destroy;
    clear(view, ids.length > 1 ? h('p', { class: 'muted center' }, `Workout ${i + 1} / ${ids.length}`) : null, p.el);
  };

  home();
  return () => destroy?.();
}
