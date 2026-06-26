import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
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

export async function deleteSponsorLogoByUrl(logoUrl: string): Promise<void> {
  const storage = getFirebaseStorage();
  if (!storage || !logoUrl.includes('/o/')) return;

  try {
    const encoded = logoUrl.split('/o/')[1]?.split('?')[0];
    if (!encoded) return;
    const path = decodeURIComponent(encoded);
    if (path.startsWith('sponsors/')) {
      await deleteObject(ref(storage, path));
    }
  } catch {
    // ignore missing objects
  }
}
