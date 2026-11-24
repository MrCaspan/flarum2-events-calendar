<?php

/*
 * This file is part of mrcaspan/flarum2-events-calendar.
 *
 * For license information, please view the LICENSE file
 * that was distributed with this source code.
 */

namespace MrCaspan\EventsCalendar;

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Discussion\Discussion;
use Flarum\Extend;
use Flarum\Settings\SettingsRepositoryInterface;
use MrCaspan\EventsCalendar\Api\Controllers\CalendarListController;
use MrCaspan\EventsCalendar\Api\Controllers\GameController;
use MrCaspan\EventsCalendar\Api\Controllers\GameUserSearchController;
use MrCaspan\EventsCalendar\Api\DiscussionResourceFields;
use MrCaspan\EventsCalendar\Game\GameNotificationBlueprint;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/resources/less/forum.less')
        ->route('/events', 'events-calendar'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    (new Extend\Routes('api'))
        ->get('/events-calendar', 'events-calendar.list', CalendarListController::class)
        ->get('/events-calendar/{id:[0-9]+}', 'events-calendar.game.show', GameController::class)
        ->post('/events-calendar/{id:[0-9]+}', 'events-calendar.game.act', GameController::class)
        ->get('/events-calendar/{id:[0-9]+}/users', 'events-calendar.game.users', GameUserSearchController::class),

    (new Extend\Notification())
        ->type(GameNotificationBlueprint::class, ['alert', 'email']),

    (new Extend\View())
        ->namespace('events-calendar', __DIR__.'/resources/views'),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Settings())
        ->default('mrcaspan-events-calendar.events_tag', '')
        ->serializeToForum('eventsCalendar.eventsTag', 'mrcaspan-events-calendar.events_tag', 'strval')
        ->default('mrcaspan-events-calendar.require_date', false)
        ->serializeToForum('eventsCalendar.requireDate', 'mrcaspan-events-calendar.require_date', 'boolval')
        // The forum's own words ("Event", "Attendee", "Spot", ...), as one object.
        ->serializeToForum(
            'eventsCalendar.words',
            Words::PREFIX.'word_event',
            fn () => Words::all(resolve(SettingsRepositoryInterface::class))
        ),

    (new Extend\Model(Discussion::class))
        ->hasOne('discussionEvent', DiscussionEvent::class, 'discussion_id'),

    // Flarum 2.0: discussion attributes are declared on the API resource
    // (replaces the 1.x ApiSerializer + ApiController extenders).
    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(DiscussionResourceFields::class)
        ->endpoint(
            [Endpoint\Index::class, Endpoint\Show::class],
            fn (Endpoint\Index|Endpoint\Show $endpoint) => $endpoint->eagerLoad('discussionEvent')
        ),
];
