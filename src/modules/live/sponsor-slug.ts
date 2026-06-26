/** Slugify sponsor name for Firebase Storage filenames. */
export function slugifySponsorName(name: string, suffix = ''): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const slug = base || 'sponsor';
  return suffix ? `${slug}-${suffix}` : slug;
}

export function sponsorStoragePath(slug: string): string {
  return `sponsors/${slug}.webp`;
}

/** Resolve unique slug when names collide. */
export function resolveSponsorSlug(name: string, existingSlugs: string[]): string {
  let slug = slugifySponsorName(name);
  if (!existingSlugs.includes(slug)) return slug;

  let index = 2;
  while (existingSlugs.includes(slugifySponsorName(name, String(index)))) {
    index += 1;
  }
  return slugifySponsorName(name, String(index));
}
