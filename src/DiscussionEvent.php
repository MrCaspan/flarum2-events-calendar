<?php

namespace MrCaspan\EventsCalendar;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\Discussion\Discussion;

/**
 * @property int $discussion_id
 * @property Carbon $event_at  Stored in UTC.
 * @property Discussion $discussion
 */
class DiscussionEvent extends AbstractModel
{
    protected $table = 'events_calendar_dates';

    protected $primaryKey = 'discussion_id';

    public $incrementing = false;

    public $timestamps = false;

    protected $casts = [
        'discussion_id' => 'integer',
        'event_at' => 'datetime',
    ];

    protected $fillable = ['discussion_id', 'event_at'];

    public function discussion()
    {
        return $this->belongsTo(Discussion::class);
    }
}
