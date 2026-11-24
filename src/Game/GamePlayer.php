<?php

namespace MrCaspan\EventsCalendar\Game;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\User\User;

/**
 * One person on a game's player list.
 *
 * Statuses:
 *  - confirmed  seated, said yes
 *  - invited    seated by the host, awaiting a reply
 *  - offered    moved up from the waitlist, must reply before offer_expires_at
 *  - waitlist   in line, ordered by position
 *  - requested  asked to join, awaiting the host
 *  - declined   can't make it / dropped out
 *  - expired    didn't answer a seat offer in time
 *
 * @property int $id
 * @property int $discussion_id
 * @property int|null $user_id      null for a non-member (see guest_name)
 * @property string|null $guest_name  a non-member added by the host: just a name
 * @property string $status
 * @property int $position
 * @property string|null $note
 * @property Carbon|null $offer_expires_at
 * @property User|null $user
 */
class GamePlayer extends AbstractModel
{
    protected $table = 'events_calendar_attendees';

    public $timestamps = true;

    protected $casts = [
        'discussion_id' => 'integer',
        'user_id' => 'integer',
        'position' => 'integer',
        'offer_expires_at' => 'datetime',
    ];

    protected $fillable = ['discussion_id', 'user_id', 'guest_name', 'status', 'position', 'note', 'offer_expires_at'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
