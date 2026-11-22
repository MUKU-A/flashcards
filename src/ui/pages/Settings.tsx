import { dirty } from '../../data';
import { settings } from '../../settings';
import { authError, email, isConfigured, logout, redirectUri, startLogin, validToken, token } from '../../sync/auth';
import { indicator, lastSyncAt, syncError, syncNow, syncing } from '../../sync/sync';
import { formatDateTime } from '../../util';

export function Settings() {
  void token.value;
  const loggedIn = !!validToken();
  const d = dirty.value;

  return (
    <div>
      <h1>設定</h1>

      <div class="panel stack">
        <h2>Google アカウント</h2>
        {!isConfigured() ? (
          <div class="small">
            <p class="error-text" style="margin-top:0">
              Google のクライアントIDが設定されていないため、この端末の中だけで動いています。
            </p>
            <p class="muted" style="margin-bottom:0">
              README の手順で <code>VITE_GOOGLE_CLIENT_ID</code> を設定してからビルドしてください。
            </p>
          </div>
        ) : (
          <>
            <div class="row">
              <div>
                {email.value ? <strong>{email.value}</strong> : <span class="muted">未ログイン</span>}
                <div class="muted small">
                  {loggedIn ? 'ログイン中（約1時間で切れます。同期のときに再ログインします）' : 'ログインが切れています'}
                </div>
              </div>
              <span class="spacer" />
              {loggedIn ? (
                <button
                  class="btn small"
                  onClick={async () => {
                    if (confirm('ログアウトしますか？端末内のカードはそのまま残ります。')) await logout();
                  }}
                >
                  ログアウト
                </button>
              ) : (
                <button class="btn small primary" onClick={startLogin}>
                  Google でログイン
                </button>
              )}
            </div>
            {authError.value && <p class="error-text small">{authError.value}</p>}
          </>
        )}
      </div>

      {isConfigured() && (
        <div class="panel stack">
          <h2>同期</h2>
          <div class="small">
            <div>最終同期：{formatDateTime(lastSyncAt.value)}</div>
            <div>
              未送信：{d.cards ? 'カードの変更あり' : 'カードの変更なし'}・履歴ファイル {d.files.length}件
            </div>
            {syncError.value && <div class="error-text">エラー：{syncError.value}</div>}
          </div>
          <button
            class="btn primary"
            disabled={syncing.value || indicator.value === 'offline'}
            onClick={() => (loggedIn ? void syncNow() : startLogin())}
          >
            {syncing.value ? '同期中…' : loggedIn ? '今すぐ同期' : 'ログインして同期'}
          </button>
          <p class="muted small" style="margin:0">
            データは Google ドライブの「マイドライブ / Flashcards」フォルダに保存されます。
          </p>
        </div>
      )}

      <div class="panel stack">
        <h2>カードの作成</h2>
        <label class="switch">
          <input
            type="checkbox"
            checked={settings.value.inheritTags}
            onChange={(e) => (settings.value = { ...settings.value, inheritTags: (e.target as HTMLInputElement).checked })}
          />
          <span>
            新しいカードに直前のタグを引き継ぐ
            <div class="muted small">同じ分野のカードを続けて作るときに便利です</div>
          </span>
        </label>
      </div>

      <p class="muted small center">リダイレクトURI：{redirectUri()}</p>
    </div>
  );
}
