# Events Calendar for Flarum 2.0

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Flarum](https://img.shields.io/badge/flarum-2.0-orange.svg)

Turn discussions into events. Discussions in your events tag get a date, show up on a calendar, and can have an attendee list with RSVPs and a wait list. **You choose the words**: call them events, games, meetups, rides or sessions.

## Features

- **Calendar page** at `/events` (month and list views), linked from the sidebar.
- **Event date** ("When?") in the composer for discussions in the events tag, shown at the top of the first post. The author, or anyone who can rename the discussion, can change it.
- **"Post Event"** button on the calendar page that preselects the events tag.
- **Attendee list** on any event that has a date (the host adds it; it isn't an event until it has a date, and an event with a list can have its date changed but not removed):
  - number of spots and an optional minimum to go ahead ("Need 2 more confirmed"), then a go-ahead message you can set in the admin ("It's on! See you there.")
  - host invites members; they reply **I'm in** / **Can't make it**
  - members can ask to join, and the host approves
  - **wait list** in order, and the host moves people in when a spot opens. Wait lists can be switched off for the whole forum (admin) or for one event (host).
  - notes after names (host only), and a host menu to approve, move, or remove people
- **Schedule Next**: the host creates the next event in one click (+1 to +4 weeks), copying the title, tags, first post, attendee list and wait list.
- **Notifications and emails** for invites, replies, requests and drop-outs (members choose alert and/or email).
- **Optional required date**: turn on "Every event must have a date and time" and a discussion in the events tag can't be posted without one.
- **Who can post events** follows the events tag's own permissions: restrict the tag in *Admin → Permissions* and choose who can "Start discussions" in it.
- **Your wording**: in the extension's settings, set what your forum calls one/several **events**, **attendees** and **spots** (defaults: Event, Attendee, Spot). Every button, label, notification and email uses them.
- Dates are stored in UTC and shown in each member's own time zone.
- Works in light and dark mode.

## Requirements

- Flarum **2.0** or later, with **flarum/tags**

## Installation

```sh
composer require mrcaspan/flarum2-events-calendar
php flarum migrate
php flarum cache:clear
```

Then in *Admin → Extensions → Events Calendar*:

1. Enable it.
2. Pick the **Events tag**: discussions in this tag are events.
3. Optionally set your **Wording** (for example Game / Games, Player / Players, Seat / Seats).

## Updating

```sh
composer update mrcaspan/flarum2-events-calendar
php flarum migrate
php flarum cache:clear
```

## Changing other texts

All texts are in `resources/locale/en.yml` and can use the wording placeholders `{Event}` `{event}` `{Events}` `{events}`, `{Attendee}` `{attendee}` `{Attendees}` `{attendees}` and `{Spot}` `{spot}` `{Spots}` `{spots}` (capitalised or lower case). To change a text on your forum without editing the extension, override its key with a language pack or a translation-editing extension. The email texts can also be edited with [Email Editor](https://github.com/MrCaspan/flarum2-email-editor).

## Credits

Built by [MrCaspan](https://github.com/MrCaspan) for [PokerForum.ca](https://pokerforum.ca). It started as a fork of [webbinaro/flarum-calendar](https://github.com/webbinaro/flarum-calendar) and was rebuilt for Flarum 2.0. The calendar uses [FullCalendar](https://fullcalendar.io) and the date picker [flatpickr](https://flatpickr.js.org).

**[Claude Code](https://claude.com/claude-code)** (Anthropic's AI coding assistant) was used to help vibe code this extension. It is used on a real Flarum 2.0 forum. Issues and pull requests are welcome.

## License

[MIT](LICENSE)
