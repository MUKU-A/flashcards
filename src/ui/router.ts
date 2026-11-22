import { signal } from '@preact/signals';

export type Route = { path: string; query: URLSearchParams };

function parse(): Route {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = h.split('?');
  return { path: path || '/', query: new URLSearchParams(qs) };
}

export const route = signal<Route>(parse());
window.addEventListener('hashchange', () => {
  route.value = parse();
  window.scrollTo(0, 0);
});

export function navigate(to: string, replace = false) {
  const hash = to.startsWith('#') ? to : `#${to}`;
  if (replace) {
    history.replaceState(null, '', hash);
    route.value = parse();
  } else location.hash = hash;
}
