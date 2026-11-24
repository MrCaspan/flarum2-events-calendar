import app from 'flarum/forum/app';

export const PREFIX = 'mrcaspan-flarum2-events-calendar.';

// Must match Words::DEFAULTS in PHP.
const DEFAULTS = {
  event: 'Event',
  events: 'Events',
  attendee: 'Attendee',
  attendees: 'Attendees',
  spot: 'Spot',
  spots: 'Spots',
};

/**
 * The forum's own words ("Event", "Attendee", "Spot", ...) from the admin
 * settings, as translation parameters: {Event} {event} {Events} {events}, ...
 */
export function words() {
  const set = app.forum.attribute('eventsCalendar.words') || {};
  const params = {};

  Object.keys(DEFAULTS).forEach((name) => {
    const word = String(set[name] || '').trim() || DEFAULTS[name];
    params[name.charAt(0).toUpperCase() + name.slice(1)] = word.charAt(0).toUpperCase() + word.slice(1);
    params[name] = word.toLowerCase();
  });

  return params;
}

/** Translate one of this extension's texts, with the forum's words filled in. */
export default function trans(key, params = {}) {
  return app.translator.trans(PREFIX + key, { ...words(), ...params });
}
