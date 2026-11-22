import { ready } from '../data';
import { route } from './router';
import { SyncBadge } from './components/SyncBadge';
import { Lightbox } from './components/Images';
import { ToastView } from './toast';
import { Home } from './pages/Home';
import { MemorizeTag } from './pages/MemorizeTag';
import { MemorizeRun } from './pages/MemorizeRun';
import { TestSetup } from './pages/TestSetup';
import { TestRun } from './pages/TestRun';
import { TestResult } from './pages/TestResult';
import { Manage } from './pages/Manage';
import { Edit } from './pages/Edit';
import { BulkImport } from './pages/BulkImport';
import { Tags } from './pages/Tags';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';

const NAV = [
  { href: '/', label: 'ホーム', ico: '⌂', match: (p: string) => p === '/' || p.startsWith('/memorize') || p.startsWith('/test') },
  { href: '/manage', label: 'カード', ico: '▤', match: (p: string) => p === '/manage' || p.startsWith('/edit') || p === '/import' },
  { href: '/tags', label: 'タグ', ico: '#', match: (p: string) => p === '/tags' },
  { href: '/stats', label: '統計', ico: '↗', match: (p: string) => p === '/stats' },
  { href: '/settings', label: '設定', ico: '⚙', match: (p: string) => p === '/settings' },
];

function Page({ path }: { path: string }) {
  if (path === '/') return <Home />;
  if (path === '/memorize/tag') return <MemorizeTag />;
  if (path === '/memorize/run') return <MemorizeRun />;
  if (path === '/test') return <TestSetup />;
  if (path === '/test/run') return <TestRun />;
  if (path === '/test/result') return <TestResult />;
  if (path === '/manage') return <Manage />;
  if (path.startsWith('/edit/')) {
    const id = decodeURIComponent(path.slice(6));
    return <Edit key={id} id={id} />;
  }
  if (path === '/import') return <BulkImport />;
  if (path === '/tags') return <Tags />;
  if (path === '/stats') return <Stats />;
  if (path === '/settings') return <Settings />;
  return <Home />;
}

export function App() {
  const path = route.value.path;
  const studying = path === '/memorize/run' || path === '/test/run';

  return (
    <div class={`app ${studying ? '' : 'with-nav'}`}>
      <header class="topbar">
        <a class="title" href="#/">
          単語カード
        </a>
        {!studying && (
          <nav class="nav">
            {NAV.map((n) => (
              <a key={n.href} href={`#${n.href}`} class={n.match(path) ? 'active' : ''}>
                {n.label}
              </a>
            ))}
          </nav>
        )}
        <SyncBadge />
      </header>

      {!ready.value ? (
        <main class="muted center">読み込み中…</main>
      ) : studying ? (
        <Page path={path} />
      ) : (
        <main>
          <Page path={path} />
        </main>
      )}

      {!studying && (
        <nav class="bottom-nav">
          {NAV.map((n) => (
            <a key={n.href} href={`#${n.href}`} class={n.match(path) ? 'active' : ''}>
              <span class="ico">{n.ico}</span>
              {n.label}
            </a>
          ))}
        </nav>
      )}
      <ToastView />
      <Lightbox />
    </div>
  );
}
