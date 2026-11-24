<?php

/*
 * This file is part of mrcaspan/flarum2-events-calendar.
 *
 * For license information, please view the LICENSE file
 * that was distributed with this source code.
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    // The host's switch: whether this event has a wait list.
    'up' => function (Builder $schema) {
        if (! $schema->hasColumn('events_calendar_lists', 'waitlist')) {
            $schema->table('events_calendar_lists', function (Blueprint $table) {
                $table->boolean('waitlist')->default(true)->after('allow_requests');
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasColumn('events_calendar_lists', 'waitlist')) {
            $schema->table('events_calendar_lists', function (Blueprint $table) {
                $table->dropColumn('waitlist');
            });
        }
    },
];
