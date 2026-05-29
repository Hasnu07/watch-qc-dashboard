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
 * Optional hover assets (animated GIF or alternate pose):
 *   hasnain-graphics-hover.gif | .jpg | .png
 *
 * Lookup is case-insensitive on team member display name.
 */

const PROFILE_AVATAR_HOVER_SLUGS: Record<string, string> = {
  'hasnain graphics': 'hasnain-graphics-hover',
}

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

/** Hover avatar URL (GIF preferred). */
export function getProfileAvatarHoverUrl(name: string): string | null {
  return getProfileAvatarHoverFallbacks(name)[0] ?? null
}

export function getProfileAvatarHoverFallbacks(name: string): string[] {
  const slug = PROFILE_AVATAR_HOVER_SLUGS[normalizeMemberName(name)]
  if (!slug) return []
  return [`/profiles/${slug}.gif`, `/profiles/${slug}.webp`, `/profiles/${slug}.jpg`, `/profiles/${slug}.png`]
}
