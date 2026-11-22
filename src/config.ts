/** Google Cloud の OAuth クライアントID。ビルド時に VITE_GOOGLE_CLIENT_ID から読み込む */
export const GOOGLE_CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
/** Drive 上のフォルダ名（マイドライブ直下） */
export const DRIVE_FOLDER_NAME = 'Flashcards';
export const DRIVE_IMAGES_FOLDER_NAME = 'images';
export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
