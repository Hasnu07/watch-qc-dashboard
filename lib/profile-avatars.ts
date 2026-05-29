/**
 * Netflix-style login avatars (Bitmoji PNGs).
 *
 * Drop files in `public/profiles/` named by slug:
 *   aleena.png
 *   haris.png
 *   hasnain-graphics.png
 *   hassan.png
 *   johny.png
 *   josh.png
 *   kash.png
 *   master.png
 *   ummay.png
 *
 * Lookup is case-insensitive on team member display name.
 */

const PROFILE_AVATAR_SLUGS: Record<string, string> = {
  aleena: 'aleena',
  haris: 'haris',
  'hasnain graphics': 'hasnain-graphics',
  hassan: 'hassan',
  johny: 'johny',
  josh: 'josh',
  kash: 'kash',
  master: 'master',
  ummay: 'ummay',
}

/** Expected filenames under public/profiles/ (for reference). */
export const PROFILE_AVATAR_EXPECTED_FILES = [
  'aleena.png',
  'haris.png',
  'hasnain-graphics.png',
  'hassan.png',
  'johny.png',
  'josh.png',
  'kash.png',
  'master.png',
  'ummay.png',
] as const

function normalizeMemberName(name: string): string {
  return name.trim().toLowerCase()
}

/** Public URL for a member avatar, or null if name is not mapped. */
export function getProfileAvatarUrl(name: string): string | null {
  const slug = PROFILE_AVATAR_SLUGS[normalizeMemberName(name)]
  if (!slug) return null
  return `/profiles/${slug}.png`
}
