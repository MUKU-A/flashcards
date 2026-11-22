import { signal, effect } from '@preact/signals';

type Settings = { inheritTags: boolean };
const KEY = 'fc.settings';

function load(): Settings {
  try {
    return { inheritTags: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { inheritTags: false };
  }
}

export const settings = signal<Settings>(load());
effect(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings.value));
  } catch {
    /* 保存できなくても動作は続ける */
  }
});
