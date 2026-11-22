/**
 * Google OAuth（インプリシットフロー・リダイレクト方式）。
 * ポップアップを使わないので、Pixel にインストールした PWA からでも確実にログインできる。
 * アクセストークンは約1時間有効。切れたら同期のときにだけ再ログインする。
 */
import { signal } from '@preact/signals';
import { GOOGLE_CLIENT_ID, SCOPE } from '../config';
import { uuid } from '../util';

const TOKEN_KEY = 'fc.token';
const EMAIL_KEY = 'fc.email';
const STATE_KEY = 'fc.oauthState';
const RETURN_KEY = 'fc.returnRoute';

type Token = { accessToken: string; expiresAt: number };

function loadToken(): Token | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as Token | null;
    return t && t.accessToken ? t : null;
  } catch {
    return null;
  }
}

export const token = signal<Token | null>(loadToken());
export const email = signal<string>(localStorage.getItem(EMAIL_KEY) ?? '');
export const authError = signal<string>('');

export const isConfigured = () => !!GOOGLE_CLIENT_ID;

export function validToken(): string | null {
  const t = token.value;
  return t && t.expiresAt - 60_000 > Date.now() ? t.accessToken : null;
}

export function redirectUri(): string {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

export function startLogin() {
  if (!isConfigured()) return;
  const state = uuid();
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_KEY, location.hash || '#/');
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
  });
  if (email.value) p.set('login_hint', email.value);
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
}

/** 起動時に呼ぶ。Google から戻ってきた URL ならトークンを取り出してルートを元に戻す */
export function handleRedirect(): boolean {
  const h = location.hash;
  if (!/(^#|&)(access_token|error)=/.test(h)) return false;
  const p = new URLSearchParams(h.slice(1));
  const expected = sessionStorage.getItem(STATE_KEY);
  const ret = sessionStorage.getItem(RETURN_KEY) || '#/';
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  history.replaceState(null, '', location.pathname + location.search + ret);
  if (p.get('error')) {
    authError.value = `ログインできませんでした（${p.get('error')}）`;
    return true;
  }
  if (!expected || p.get('state') !== expected) {
    authError.value = 'ログインの確認に失敗しました。もう一度お試しください。';
    return true;
  }
  const t: Token = {
    accessToken: p.get('access_token') ?? '',
    expiresAt: Date.now() + Number(p.get('expires_in') ?? '3600') * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  token.value = t;
  authError.value = '';
  return true;
}

export function setEmail(e: string) {
  email.value = e;
  localStorage.setItem(EMAIL_KEY, e);
}

export function expireToken() {
  localStorage.removeItem(TOKEN_KEY);
  token.value = null;
}

export async function logout() {
  const t = token.value?.accessToken;
  expireToken();
  setEmail('');
  if (t) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch {
      /* オフラインなどで失敗しても、端末からは消えている */
    }
  }
}
