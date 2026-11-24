<?php

namespace MrCaspan\EventsCalendar\Game;

use Flarum\Database\AbstractModel;

/**
 * Player-list settings for one game discussion.
 *
 * @property int $discussion_id
 * @property int $seats
 * @property int|null $min_players
 * @property bool $allow_requests
 * @property bool $auto_offer  offer open seats to the wait list automatically
 * @property bool $waitlist    the host's switch for this event's wait list
 */
class Game extends AbstractModel
{
    protected $table = 'events_calendar_lists';

    protected $primaryKey = 'discussion_id';

    public $incrementing = false;

    public $timestamps = true;

    protected $casts = [
        'discussion_id' => 'integer',
        'seats' => 'integer',
        'min_players' => 'integer',
        'allow_requests' => 'boolean',
        'auto_offer' => 'boolean',
        'waitlist' => 'boolean',
    ];

    protected $fillable = ['discussion_id', 'seats', 'min_players', 'allow_requests', 'auto_offer', 'waitlist'];

    /**
     * Whether this event has a wait list: the forum allows wait lists (admin
     * setting) and the host hasn't switched it off for this event.
     */
    public function hasWaitlist(): bool
    {
        $forum = (bool) resolve(\Flarum\Settings\SettingsRepositoryInterface::class)
            ->get('mrcaspan-events-calendar.waitlist_enabled', true);

        return $forum && ($this->waitlist ?? true);
    }
}
