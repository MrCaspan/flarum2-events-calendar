<?php

/*
 * This file is part of mrcaspan/flarum2-events-calendar.
 *
 * For license information, please view the LICENSE file
 * that was distributed with this source code.
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

// Non-members on a list: just a name, typed in by the host (no account, no notifications).
return [
    'up' => function (Builder $schema) {
        $schema->table('events_calendar_attendees', function (Blueprint $table) use ($schema) {
            $table->integer('user_id')->unsigned()->nullable()->change();

            if (! $schema->hasColumn('events_calendar_attendees', 'guest_name')) {
                $table->string('guest_name', 60)->nullable()->after('user_id');
            }
        });
    },
    'down' => function (Builder $schema) {
        $schema->getConnection()->table('events_calendar_attendees')->whereNull('user_id')->delete();

        $schema->table('events_calendar_attendees', function (Blueprint $table) {
            $table->dropColumn('guest_name');
            $table->integer('user_id')->unsigned()->nullable(false)->change();
        });
    },
];
