import app from 'flarum/forum/app';

export function eventsTagSlug() {
  return app.forum.attribute('eventsCalendar.eventsTag') || '';
}

/** The events Tag model, if the tags have been loaded into the store. */
export function findEventsTag() {
  const slug = eventsTagSlug();
  if (!slug) return null;

  return app.store.all('tags').find((t) => t && typeof t.slug === 'function' && t.slug() === slug) || null;
}

export function isInEventsTag(tags) {
  const slug = eventsTagSlug();
  if (!slug || !tags) return false;

  return tags.some((t) => t && typeof t.slug === 'function' && t.slug() === slug);
}

/** Mirrors the server rule: the author, or anyone who can rename the discussion. */
export function canEditEvent(discussion) {
  const user = app.session.user;
  if (!user) return false;
  if (discussion.canRename && discussion.canRename()) return true;

  const author = discussion.user && discussion.user();
  return !!(author && author.id() === user.id());
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Date -> value for an <input type="datetime-local"> in the viewer's timezone. */
export function toLocalInput(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (viewer's timezone) -> ISO 8601 UTC string for the API. */
export function localInputToIso(value) {
  if (!value) return null;
  const d = new Date(value);

  return isNaN(d.getTime()) ? null : d.toISOString();
}
