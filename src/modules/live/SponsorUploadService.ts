import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { getFirebaseStorage } from '@/config/firebase-app';
import { resolveSponsorSlug, sponsorStoragePath } from '@/modules/live/sponsor-slug';

/** Resize and compress image to WebP for sponsor upload (max ~400px wide). */
export async function compressSponsorImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 400;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to compress image'));
      },
      'image/webp',
      0.85
    );
  });
}

export async function uploadSponsorLogo(
  file: File,
  sponsorName: string,
  existingSlugs: string[]
): Promise<string> {
  const storage = getFirebaseStorage();
  if (!storage) throw new Error('Firebase Storage is not configured');

  const slug = resolveSponsorSlug(sponsorName, existingSlugs);
  const path = sponsorStoragePath(slug);
  const blob = await compressSponsorImage(file);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
  return getDownloadURL(storageRef);
}

/** Parse Firebase Storage path for sponsor logos uploaded by this app. */
export function parseSponsorLogoStoragePath(logoUrl: string): string | null {
  const trimmed = logoUrl.trim();
  if (!trimmed) return null;

  if (trimmed.includes('/o/')) {
    const encoded = trimmed.split('/o/')[1]?.split('?')[0];
    if (!encoded) return null;
    try {
      const path = decodeURIComponent(encoded);
      return path.startsWith('sponsors/') ? path : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function isManagedSponsorLogoUrl(logoUrl: string): boolean {
  return parseSponsorLogoStoragePath(logoUrl) != null;
}

function isObjectNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error != null &&
    'code' in error &&
    (error as { code: string }).code === 'storage/object-not-found'
  );
}

/**
 * Delete a sponsor logo file from Firebase Storage when it lives under sponsors/.
 * External/pasted URLs are skipped. Returns true when the file is gone or was never stored.
 */
export async function deleteSponsorLogoByUrl(logoUrl: string): Promise<boolean> {
  const storage = getFirebaseStorage();
  if (!storage || !logoUrl.trim()) return false;

  const path = parseSponsorLogoStoragePath(logoUrl);
  if (!path) return false;

  try {
    await deleteObject(ref(storage, path));
    return true;
  } catch (error) {
    if (isObjectNotFound(error)) return true;
    throw error;
  }
}
