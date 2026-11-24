<?php

/*
 * This file is part of mrcaspan/flarum2-events-calendar.
 *
 * For license information, please view the LICENSE file
 * that was distributed with this source code.
 */

namespace MrCaspan\EventsCalendar;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * The forum's own words for the things this extension talks about ("Event",
 * "Attendee", "Spot", ...), set in the extension's admin settings. Every text
 * gets them as placeholders: {Event} {event} {Events} {events}, and the same
 * for attendee(s) and spot(s).
 */
class Words
{
    public const PREFIX = 'mrcaspan-events-calendar.';

    public const DEFAULTS = [
        'event' => 'Event',
        'events' => 'Events',
        'attendee' => 'Attendee',
        'attendees' => 'Attendees',
        'spot' => 'Spot',
        'spots' => 'Spots',
    ];

    /**
     * @return array<string, string> name => word as the admin typed it (default if empty)
     */
    public static function all(SettingsRepositoryInterface $settings): array
    {
        $out = [];

        foreach (self::DEFAULTS as $name => $default) {
            $value = trim((string) $settings->get(self::PREFIX.'word_'.$name, ''));
            $out[$name] = $value !== '' ? $value : $default;
        }

        return $out;
    }

    /**
     * Translation parameters: "{Event}" => "Game", "{event}" => "game", ...
     *
     * @return array<string, string>
     */
    public static function params(SettingsRepositoryInterface $settings): array
    {
        $params = [];

        foreach (self::all($settings) as $name => $word) {
            $params['{'.ucfirst($name).'}'] = mb_strtoupper(mb_substr($word, 0, 1)).mb_substr($word, 1);
            $params['{'.$name.'}'] = mb_strtolower($word);
        }

        return $params;
    }
}
