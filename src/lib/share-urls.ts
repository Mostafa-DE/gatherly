export function buildOrgUrl(username: string, groupSlug: string) {
  return `${window.location.origin}/${username}/${groupSlug}`
}

export function buildSessionUrl(
  username: string,
  groupSlug: string,
  sessionId: string
) {
  return `${window.location.origin}/${username}/${groupSlug}/sessions/${sessionId}`
}

export function buildInviteUrl(
  username: string,
  groupSlug: string,
  token: string
) {
  return `${window.location.origin}/${username}/${groupSlug}?invite=${token}`
}

export function buildWhatsAppUrl(url: string, message?: string) {
  const text = message ? `${message} ${url}` : url
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
