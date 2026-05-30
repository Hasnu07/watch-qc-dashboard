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
 * Optional hover assets (alternate pose, soft-fade on login hover):
 *   aleena-hover.png | .jpg
 *   haris-hover.png | .jpg
 *   hasnain-graphics-hover.png | .jpg
 *   johny-hover.png | .jpg
 *
 * Lookup is case-insensitive on team member display name.
 */

const PROFILE_AVATAR_HOVER_SLUGS: Record<string, string> = {
  aleena: 'aleena-hover',
  haris: 'haris-hover',
  'hasnain graphics': 'hasnain-graphics-hover',
  johny: 'johny-hover',
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

/** Hover avatar URL (static image, soft-fade on login). */
export function getProfileAvatarHoverUrl(name: string): string | null {
  return getProfileAvatarHoverFallbacks(name)[0] ?? null
}

export function getProfileAvatarHoverFallbacks(name: string): string[] {
  const slug = PROFILE_AVATAR_HOVER_SLUGS[normalizeMemberName(name)]
  if (!slug) return []
  return [`/profiles/${slug}.png`, `/profiles/${slug}.jpg`, `/profiles/${slug}.webp`]
}
