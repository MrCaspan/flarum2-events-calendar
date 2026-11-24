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
    'up' => function (Builder $schema) {
        // The date of each event discussion (UTC).
        if (! $schema->hasTable('events_calendar_dates')) {
            $schema->create('events_calendar_dates', function (Blueprint $table) {
                $table->integer('discussion_id')->unsigned()->primary();
                $table->dateTime('event_at');
                $table->index('event_at');
                $table->foreign('discussion_id')->references('id')->on('discussions')->onDelete('cascade');
            });
        }

        // One row per event that has an attendee list.
        if (! $schema->hasTable('events_calendar_lists')) {
            $schema->create('events_calendar_lists', function (Blueprint $table) {
                $table->integer('discussion_id')->unsigned()->primary();
                $table->smallInteger('seats')->unsigned()->default(10);
                $table->smallInteger('min_players')->unsigned()->nullable();
                $table->boolean('allow_requests')->default(true);
                $table->boolean('auto_offer')->default(true);
                $table->timestamps();
                $table->foreign('discussion_id')->references('id')->on('discussions')->onDelete('cascade');
            });
        }

        // Everyone on an event's list: with a spot (confirmed / invited / offered),
        // on the wait list, asking to join, or out (declined / expired).
        if (! $schema->hasTable('events_calendar_attendees')) {
            $schema->create('events_calendar_attendees', function (Blueprint $table) {
                $table->increments('id');
                $table->integer('discussion_id')->unsigned();
                $table->integer('user_id')->unsigned();
                $table->string('status', 20);
                $table->integer('position')->default(0);
                $table->string('note', 60)->nullable();
                $table->dateTime('offer_expires_at')->nullable();
                $table->timestamps();

                $table->unique(['discussion_id', 'user_id']);
                $table->index(['discussion_id', 'status']);
                $table->foreign('discussion_id')->references('id')->on('discussions')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('events_calendar_attendees');
        $schema->dropIfExists('events_calendar_lists');
        $schema->dropIfExists('events_calendar_dates');
    },
];
