import { indicator, syncNow } from '../../sync/sync';
import { startLogin } from '../../sync/auth';
import { navigate } from '../router';

const LABEL = {
  'local-only': '端末内のみ',
  offline: 'オフライン',
  login: '要ログイン',
  syncing: '同期中…',
  error: '同期エラー',
  pending: '未送信あり',
  synced: '同期済み',
} as const;

export function SyncBadge() {
  const s = indicator.value;
  return (
    <button
      class={`sync-badge ${s}`}
      title="タップで同期"
      onClick={() => {
        if (s === 'login') startLogin();
        else if (s === 'local-only' || s === 'error') navigate('/settings');
        else if (s !== 'offline') void syncNow();
      }}
    >
      <span class="dot" />
      {LABEL[s]}
    </button>
  );
}
