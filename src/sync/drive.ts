/** Google Drive API v3 の最小限のラッパー */
import { expireToken, validToken } from './auth';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export class AuthRequiredError extends Error {
  constructor() {
    super('ログインが必要です');
  }
}
export class NotFoundError extends Error {}

export type DriveFile = { id: string; name: string; modifiedTime: string; mimeType?: string };

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const t = validToken();
  if (!t) throw new AuthRequiredError();
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}` } });
  if (res.status === 401) {
    expireToken();
    throw new AuthRequiredError();
  }
  if (res.status === 404) throw new NotFoundError(`見つかりません: ${url}`);
  if (!res.ok) throw new Error(`Drive API エラー ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

function q(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function listFiles(query: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = '';
  do {
    const p = new URLSearchParams({
      q: query,
      fields: 'nextPageToken,files(id,name,modifiedTime,mimeType)',
      pageSize: '1000',
      spaces: 'drive',
    });
    if (pageToken) p.set('pageToken', pageToken);
    const json = await (await call(`${API}/files?${p}`)).json();
    out.push(...json.files);
    pageToken = json.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

export async function listChildren(folderId: string): Promise<DriveFile[]> {
  return listFiles(`'${q(folderId)}' in parents and trashed = false`);
}

export async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  const found = await listFiles(
    `name = '${q(name)}' and mimeType = '${FOLDER_MIME}' and '${q(parentId)}' in parents and trashed = false`,
  );
  if (found.length) return found[0].id;
  const res = await call(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  return (await res.json()).id;
}

export async function folderExists(id: string): Promise<boolean> {
  try {
    const json = await (await call(`${API}/files/${id}?fields=id,trashed`)).json();
    return !json.trashed;
  } catch (e) {
    if (e instanceof NotFoundError) return false;
    throw e;
  }
}

export async function downloadJson<T>(id: string): Promise<T> {
  return (await call(`${API}/files/${id}?alt=media`)).json();
}

export async function downloadBlob(id: string): Promise<Blob> {
  return (await call(`${API}/files/${id}?alt=media`)).blob();
}

export async function createFile(
  name: string,
  parentId: string,
  body: Blob,
): Promise<{ id: string; modifiedTime: string }> {
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name, parents: [parentId] })], { type: 'application/json' }));
  form.append('file', body);
  const res = await call(`${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`, { method: 'POST', body: form });
  return res.json();
}

export async function updateFile(id: string, body: Blob): Promise<{ id: string; modifiedTime: string }> {
  const res = await call(`${UPLOAD}/files/${id}?uploadType=media&fields=id,modifiedTime`, {
    method: 'PATCH',
    headers: { 'Content-Type': body.type || 'application/octet-stream' },
    body,
  });
  return res.json();
}

/** id があれば上書き、なければ（または消されていたら）新規作成 */
export async function putFile(
  id: string | undefined,
  name: string,
  parentId: string,
  body: Blob,
): Promise<{ id: string; modifiedTime: string }> {
  if (id) {
    try {
      return await updateFile(id, body);
    } catch (e) {
      if (!(e instanceof NotFoundError)) throw e;
    }
  }
  return createFile(name, parentId, body);
}

export async function fetchEmail(): Promise<string> {
  const json = await (await call(`${API}/about?fields=user(emailAddress)`)).json();
  return json.user?.emailAddress ?? '';
}

export const jsonBlob = (v: unknown) => new Blob([JSON.stringify(v)], { type: 'application/json' });
