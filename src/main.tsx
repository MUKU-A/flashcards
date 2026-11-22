import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { handleRedirect } from './sync/auth';
import { allReferencedImageIds, loadAll } from './data';
import { initSync } from './sync/sync';
import { gcImages } from './images';
import { App } from './ui/App';

// Google のログインから戻ってきた場合は、ルーターより先に URL を元に戻す
handleRedirect();

render(<App />, document.getElementById('app')!);

loadAll()
  .then(() => {
    initSync();
    void gcImages(allReferencedImageIds());
  })
  .catch((e) => {
    console.error(e);
    document.getElementById('app')!.textContent = `データを読み込めませんでした: ${e}`;
  });

if (import.meta.env.PROD) registerSW({ immediate: true });

// ブラウザにデータを消されにくくする
navigator.storage?.persist?.().catch(() => {});
