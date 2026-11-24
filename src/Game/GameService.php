<?php

namespace MrCaspan\EventsCalendar\Game;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Foundation\ValidationException;
use Flarum\Http\SlugManager;
use Flarum\Notification\NotificationSyncer;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Flarum\Locale\TranslatorInterface;
use MrCaspan\EventsCalendar\DiscussionEvent;
use MrCaspan\EventsCalendar\Words;
use Flarum\Api\JsonApi;
use Flarum\Api\Resource\DiscussionResource;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Log\LoggerInterface;

/**
 * Player list for a home game: the host invites people, members can ask for a
 * seat, and when a seat opens the top of the waitlist is offered it with a
 * time limit that shrinks as the game gets closer.
 */
class GameService
{
    /** Statuses that take up a seat. */
    public const SEATED = ['confirmed', 'invited', 'offered'];

    /** Seats freed by the current action; only these get offered to the wait list. */
    protected int $opened = 0;

    public function __construct(
        protected NotificationSyncer $notifications,
        protected SettingsRepositoryInterface $settings,
        protected SlugManager $slugs
    ) {
    }

    // ------------------------------------------------------------------ rules

    /** The host is the game's author, or anyone who can rename the discussion. */
    public function isHost(User $actor, Discussion $discussion): bool
    {
        if ($actor->isGuest()) {
            return false;
        }

        return (int) $discussion->user_id === (int) $actor->id || $actor->can('rename', $discussion);
    }

    public function inEventsTag(Discussion $discussion): bool
    {
        $slug = (string) $this->settings->get('mrcaspan-events-calendar.events_tag', '');

        return $slug !== '' && $discussion->tags()->where('slug', $slug)->exists();
    }

    public function eventAt(Discussion $discussion): ?Carbon
    {
        return DiscussionEvent::find($discussion->id)?->event_at;
    }

    /**
     * How long a waitlisted player gets to accept an offered seat: a day when the
     * game is more than 3 days off, 8 hours within 3 days, 2 hours on game day,
     * and never past the start time.
     */
    public function offerExpiry(?Carbon $eventAt): Carbon
    {
        $now = Carbon::now();

        if (! $eventAt) {
            return $now->copy()->addHours(24);
        }

        $hoursLeft = ($eventAt->getTimestamp() - $now->getTimestamp()) / 3600;
        $window = $hoursLeft > 72 ? 24 : ($hoursLeft > 24 ? 8 : 2);
        $expires = $now->copy()->addHours($window);

        return $expires->greaterThan($eventAt) ? $eventAt->copy() : $expires;
    }

    // ------------------------------------------------------------ read model

    public function serialize(User $actor, Discussion $discussion): array
    {
        $isHost = $this->isHost($actor, $discussion);
        $game = Game::find($discussion->id);

        $base = [
            'enabled' => false,
            'isHost' => $isHost,
            'canSetup' => $isHost && $this->inEventsTag($discussion),
            'loggedIn' => ! $actor->isGuest(),
        ];

        if (! $game) {
            return $base;
        }

        $this->fillSeats($discussion, $game);

        $players = GamePlayer::with('user')
            ->where('discussion_id', $discussion->id)
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->filter(fn (GamePlayer $p) => $p->user !== null || $p->guest_name !== null);

        $mine = $players->first(fn (GamePlayer $p) => (int) $p->user_id === (int) $actor->id);

        // Everyone sees the seats and the waitlist; requests and people who are out
        // are visible only to the host (and to that person).
        $visible = $players->filter(fn (GamePlayer $p) => $isHost
            || in_array($p->status, [...self::SEATED, 'waitlist'], true)
            || (int) $p->user_id === (int) $actor->id);

        $eventAt = $this->eventAt($discussion);

        return array_merge($base, [
            'enabled' => true,
            'seats' => $game->seats,
            'minPlayers' => $game->min_players,
            'allowRequests' => $game->allow_requests,
            'autoOffer' => $game->auto_offer ?? true,
            // waitlist: this event has one; waitlistAllowed: the forum allows them at all.
            'waitlist' => $game->hasWaitlist(),
            'waitlistOwn' => (bool) ($game->waitlist ?? true),
            'waitlistAllowed' => (bool) $this->settings->get('mrcaspan-events-calendar.waitlist_enabled', true),
            'started' => $eventAt !== null && $eventAt->isPast(),
            'hostId' => (int) $discussion->user_id,
            'me' => $mine ? [
                'id' => $mine->id,
                'status' => $mine->status,
                'offerExpiresAt' => $mine->offer_expires_at?->toIso8601String(),
            ] : null,
            'players' => $visible->map(fn (GamePlayer $p) => [
                'id' => $p->id,
                'status' => $p->status,
                'position' => $p->position,
                // Host's private notes (e.g. real names) are never sent to anyone else.
                'note' => $isHost ? $p->note : null,
                'offerExpiresAt' => $p->offer_expires_at?->toIso8601String(),
                'user' => $p->user ? $this->serializeUser($p->user) : $this->serializeGuest($p),
            ])->values()->all(),
        ]);
    }

    /** A non-member on the list: just the name the host typed. */
    protected function serializeGuest(GamePlayer $p): array
    {
        return [
            'id' => null,
            'guest' => true,
            'username' => null,
            'displayName' => (string) $p->guest_name,
            'avatarUrl' => null,
            'slug' => null,
        ];
    }

    public function serializeUser(User $user): array
    {
        return [
            'id' => (int) $user->id,
            'username' => $user->username,
            'displayName' => $user->display_name,
            'avatarUrl' => $user->avatar_url,
            'slug' => $this->slugs->forResource(User::class)->toSlug($user),
        ];
    }

    // ---------------------------------------------------------------- actions

    public function act(User $actor, Discussion $discussion, string $action, array $input): void
    {
        $actor->assertRegistered();

        $this->opened = 0;
        $isHost = $this->isHost($actor, $discussion);
        $game = Game::find($discussion->id);

        if ($action === 'settings') {
            $this->requireHost($isHost);
            $this->saveSettings($discussion, $game, $input);

            return;
        }

        if (! $game) {
            $this->fail('no_list');
        }

        if ($action === 'disable') {
            $this->requireHost($isHost);
            GamePlayer::where('discussion_id', $discussion->id)->delete();
            $game->delete();

            return;
        }

        $host = $discussion->user;

        match ($action) {
            // ---- the viewer's own place on the list
            'request' => $this->request($actor, $discussion, $game, $isHost, $host),
            'cancel' => $this->ownRow($actor, $discussion, ['requested'])->delete(),
            'accept' => $this->respond($actor, $discussion, true, $host),
            'decline' => $this->respond($actor, $discussion, false, $host),
            'leave' => $this->leave($actor, $discussion, $host),

            // ---- host management
            'invite' => $this->invite($actor, $discussion, $game, $isHost, (int) ($input['userId'] ?? 0), ! empty($input['toWaitlist'])),
            'addGuest' => $this->addGuest($discussion, $game, $isHost, (string) ($input['guestName'] ?? ''), ! empty($input['toWaitlist'])),
            default => $this->hostAction($actor, $discussion, $game, $isHost, $action, $input),
        };

        // Only seats freed by this action (decline / drop out / remove) are offered.
        $this->fillSeats($discussion, $game->fresh() ?? $game, $this->opened);
    }

    protected function saveSettings(Discussion $discussion, ?Game $game, array $input): void
    {
        $isNew = ! $game;
        $oldSeats = $game ? $game->seats : 0;

        if ($isNew) {
            if (! $this->inEventsTag($discussion)) {
                $this->fail('not_events_tag');
            }

            // It isn't an event until it has a date: no attendee list before that.
            if (! $this->eventAt($discussion)) {
                $this->fail('list_needs_date');
            }

            $game = new Game(['discussion_id' => $discussion->id, 'seats' => 10, 'allow_requests' => true]);
        }

        if (array_key_exists('seats', $input)) {
            $game->seats = max(1, min(100, (int) $input['seats']));
        }

        if (array_key_exists('minPlayers', $input)) {
            $min = $input['minPlayers'];
            $game->min_players = ($min === null || $min === '' || (int) $min <= 0) ? null : min(100, (int) $min);
        }

        if (array_key_exists('allowRequests', $input)) {
            $game->allow_requests = (bool) $input['allowRequests'];
        }

        if (array_key_exists('autoOffer', $input)) {
            $game->auto_offer = (bool) $input['autoOffer'];
        }

        if (array_key_exists('waitlist', $input)) {
            $game->waitlist = (bool) $input['waitlist'];
        }

        $game->save();

        // The host takes the first seat.
        if ($isNew && $discussion->user_id) {
            GamePlayer::firstOrCreate(
                ['discussion_id' => $discussion->id, 'user_id' => $discussion->user_id],
                ['status' => 'confirmed', 'position' => 1]
            );
        }

        // Added seats count as newly opened; existing open seats stay as they are.
        $this->fillSeats($discussion, $game, $isNew ? 0 : max(0, $game->seats - $oldSeats));
    }

    protected function request(User $actor, Discussion $discussion, Game $game, bool $isHost, ?User $host): void
    {
        if (! $game->allow_requests && ! $isHost) {
            $this->fail('no_requests');
        }

        $row = $this->findRow($discussion, $actor->id);

        if ($row && ! in_array($row->status, ['declined', 'expired'], true)) {
            $this->fail('already_listed');
        }

        // Full, and no wait list to join.
        if (! $game->hasWaitlist() && $this->freeSeats($discussion, $game) <= 0) {
            $this->fail('full_no_waitlist');
        }

        $row ??= new GamePlayer(['discussion_id' => $discussion->id, 'user_id' => $actor->id]);
        $row->status = 'requested';
        $row->position = 0;
        $row->offer_expires_at = null;
        $row->save();

        $this->notify($discussion, [$host], 'request', $actor);
    }

    protected function respond(User $actor, Discussion $discussion, bool $yes, ?User $host): void
    {
        $row = $this->ownRow($actor, $discussion, ['invited', 'offered']);
        $row->status = $yes ? 'confirmed' : 'declined';
        $row->offer_expires_at = null;
        $row->save();

        if (! $yes) {
            $this->opened++;
        }

        $this->notify($discussion, [$host], $yes ? 'accepted' : 'declined', $actor);
    }

    protected function leave(User $actor, Discussion $discussion, ?User $host): void
    {
        $row = $this->ownRow($actor, $discussion, ['confirmed', 'waitlist']);
        $wasSeated = $row->status === 'confirmed';
        $row->status = 'declined';
        $row->save();

        if ($wasSeated) {
            $this->opened++;
        }

        $this->notify($discussion, [$host], $wasSeated ? 'left' : 'left_waitlist', $actor);
    }

    /** Add a member: to an open seat (or the wait list when full), or straight to the wait list. */
    protected function invite(User $actor, Discussion $discussion, Game $game, bool $isHost, int $userId, bool $toWaitlist = false): void
    {
        $this->requireHost($isHost);

        $user = User::find($userId);
        if (! $user) {
            $this->fail('member_not_found');
        }

        $row = $this->findRow($discussion, $user->id);

        if ($row && ! in_array($row->status, ['declined', 'expired', 'requested'], true)) {
            $this->fail('member_already_listed', ['{name}' => $user->display_name]);
        }

        $hasSeat = $this->freeSeats($discussion, $game) > 0;

        // No wait list on this event: people can only be added to an open spot.
        if (! $game->hasWaitlist() && ($toWaitlist || ! $hasSeat)) {
            $this->fail($toWaitlist ? 'waitlist_off' : 'no_open_spots');
        }

        $row ??= new GamePlayer(['discussion_id' => $discussion->id, 'user_id' => $user->id]);
        $wasRequest = $row->exists && $row->status === 'requested';

        if (! $toWaitlist && $hasSeat) {
            // Someone who asked to come is confirmed straight away.
            $row->status = $wasRequest ? 'confirmed' : 'invited';
            $row->position = $this->nextPosition($discussion, self::SEATED);
            $kind = $wasRequest ? 'approved_seat' : 'invited';
        } else {
            $row->status = 'waitlist';
            $row->position = $this->nextPosition($discussion, ['waitlist']);
            $kind = 'approved_waitlist';
        }

        $row->offer_expires_at = null;
        $row->save();

        // Going on the wait list is silent: no notification or email.
        if ($kind !== 'approved_waitlist') {
            $this->notify($discussion, [$user], $kind, $actor);
        }
    }

    /**
     * Add a non-member by name. They go on the list exactly like a member the
     * host adds (open spot, or the wait list), but are never notified.
     */
    protected function addGuest(Discussion $discussion, Game $game, bool $isHost, string $name, bool $toWaitlist = false): void
    {
        $this->requireHost($isHost);

        $name = mb_substr(trim(preg_replace('/\s+/u', ' ', $name)), 0, 60);
        if ($name === '') {
            $this->fail('guest_name_required');
        }

        $row = GamePlayer::where('discussion_id', $discussion->id)
            ->whereNull('user_id')
            ->where('guest_name', $name)
            ->first();

        if ($row && ! in_array($row->status, ['declined', 'expired'], true)) {
            $this->fail('member_already_listed', ['{name}' => $name]);
        }

        $hasSeat = $this->freeSeats($discussion, $game) > 0;

        if (! $game->hasWaitlist() && ($toWaitlist || ! $hasSeat)) {
            $this->fail($toWaitlist ? 'waitlist_off' : 'no_open_spots');
        }

        $row ??= new GamePlayer(['discussion_id' => $discussion->id, 'user_id' => null, 'guest_name' => $name]);

        if (! $toWaitlist && $hasSeat) {
            $row->status = 'invited';
            $row->position = $this->nextPosition($discussion, self::SEATED);
        } else {
            $row->status = 'waitlist';
            $row->position = $this->nextPosition($discussion, ['waitlist']);
        }

        $row->offer_expires_at = null;
        $row->save();
    }

    protected function hostAction(User $actor, Discussion $discussion, Game $game, bool $isHost, string $action, array $input): void
    {
        $this->requireHost($isHost);

        $row = GamePlayer::where('discussion_id', $discussion->id)->find((int) ($input['playerId'] ?? 0));
        if (! $row) {
            $this->fail('not_on_list');
        }

        $seated = in_array($row->status, self::SEATED, true);

        switch ($action) {
            case 'approve':
                $this->invite($actor, $discussion, $game, true, $row->user_id);
                break;

            case 'confirm':
                if (! $seated) {
                    $this->requireFreeSeat($discussion, $game);
                    $row->position = $this->nextPosition($discussion, self::SEATED);
                }
                $row->status = 'confirmed';
                $row->offer_expires_at = null;
                $row->save();
                break;

            case 'seat':
                if ($seated) {
                    break;
                }
                $this->requireFreeSeat($discussion, $game);
                $row->status = 'invited';
                $row->position = $this->nextPosition($discussion, self::SEATED);
                $row->offer_expires_at = null;
                $row->save();
                $this->notify($discussion, [$row->user], 'invited', $actor);
                break;

            case 'waitlist':
                if (! $game->hasWaitlist()) {
                    $this->fail('waitlist_off');
                }
                $row->status = 'waitlist';
                $row->position = $this->nextPosition($discussion, ['waitlist']);
                $row->offer_expires_at = null;
                $row->save();
                break;

            case 'up':
            case 'down':
                $this->move($discussion, $row, $action === 'up' ? -1 : 1);
                break;

            case 'note':
                $note = trim((string) ($input['note'] ?? ''));
                $row->note = $note === '' ? null : mb_substr($note, 0, 60);
                $row->save();
                break;

            case 'remove':
                $row->delete();
                if ($seated) {
                    $this->opened++;
                }
                break;

            default:
                $this->fail('unknown_action');
        }
    }

    /** Swap a player with the neighbour above or below in the same group. */
    protected function move(Discussion $discussion, GamePlayer $row, int $direction): void
    {
        $group = in_array($row->status, self::SEATED, true) ? self::SEATED : [$row->status];

        $rows = GamePlayer::where('discussion_id', $discussion->id)
            ->whereIn('status', $group)
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->values();

        // Renumber first so positions are distinct.
        foreach ($rows as $i => $r) {
            if ($r->position !== $i + 1) {
                $r->position = $i + 1;
                $r->save();
            }
        }

        $index = $rows->search(fn ($r) => $r->id === $row->id);
        $other = $rows->get($index + $direction);

        if ($index === false || ! $other) {
            return;
        }

        $mine = $rows->get($index);
        [$mine->position, $other->position] = [$other->position, $mine->position];
        $mine->save();
        $other->save();
    }

    // ------------------------------------------------------ schedule next game

    /**
     * Start the next game from this one: same tags and first-post text, a new
     * title and date, the same list settings, and optionally the same players
     * (seated people re-invited to confirm, the wait list kept in order).
     *
     * The discussion is created through core's own API, so the usual permission,
     * tag, flood and formatting rules all apply.
     */
    public function scheduleNext(User $actor, Discussion $source, array $input, ServerRequestInterface $request): Discussion
    {
        $actor->assertRegistered();
        $this->requireHost($this->isHost($actor, $source));

        $title = trim((string) ($input['title'] ?? ''));
        $eventAt = trim((string) ($input['eventAt'] ?? ''));

        if ($title === '') {
            $this->fail('next_title_required');
        }
        if ($eventAt === '' || strtotime($eventAt) === false) {
            $this->fail('next_date_required');
        }

        $firstPost = $source->firstPost ?? $source->posts()->where('number', 1)->first();
        $content = $firstPost ? (string) $firstPost->content : '';

        if (trim($content) === '') {
            $this->fail('no_post_text');
        }

        $tags = $source->tags()->get()
            ->map(fn ($tag) => ['type' => 'tags', 'id' => (string) $tag->id])
            ->values()
            ->all();

        /** @var Discussion $new */
        $new = resolve(JsonApi::class)
            ->forResource(DiscussionResource::class)
            ->forEndpoint('create')
            ->withRequest($request)
            ->process([
                'data' => [
                    'attributes' => ['title' => $title, 'content' => $content, 'eventAt' => $eventAt],
                    'relationships' => ['tags' => ['data' => $tags]],
                ],
            ], [], ['actor' => $actor]);

        $sourceGame = Game::find($source->id);

        if ($sourceGame) {
            $this->copyList($actor, $source, $sourceGame, $new, ! empty($input['copyPlayers']), ! empty($input['copyWaitlist']));
        }

        return $new;
    }

    /** Copy list settings, plus (separately) the seated players and the wait list. */
    protected function copyList(User $actor, Discussion $source, Game $sourceGame, Discussion $new, bool $copyPlayers, bool $copyWaitlist = false): void
    {
        $game = Game::create([
            'discussion_id' => $new->id,
            'seats' => $sourceGame->seats,
            'min_players' => $sourceGame->min_players,
            'allow_requests' => $sourceGame->allow_requests,
            'auto_offer' => $sourceGame->auto_offer ?? true,
            'waitlist' => $sourceGame->waitlist ?? true,
        ]);

        // No wait list on the new event: there's nowhere to copy one to.
        $copyWaitlist = $copyWaitlist && $game->hasWaitlist();

        // The person scheduling it hosts it and takes the first seat.
        GamePlayer::create([
            'discussion_id' => $new->id,
            'user_id' => $actor->id,
            'status' => 'confirmed',
            'position' => 1,
        ]);

        $statuses = array_merge($copyPlayers ? self::SEATED : [], $copyWaitlist ? ['waitlist'] : []);

        if ($statuses) {
            $rows = GamePlayer::with('user')
                ->where('discussion_id', $source->id)
                ->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', '!=', $actor->id))
                ->whereIn('status', $statuses)
                ->orderBy('position')
                ->orderBy('id')
                ->get();

            // Seated players first (in seat order), then the wait list (in line order).
            $rows = $rows->sortBy(fn ($r) => in_array($r->status, self::SEATED, true) ? 0 : 1, SORT_REGULAR, false)->values();

            $invited = [];
            $seat = 1;
            $line = 0;

            foreach ($rows as $row) {
                if (! $row->user && $row->guest_name === null) {
                    continue;
                }

                // Everyone seated has to confirm again for the new date.
                $seated = in_array($row->status, self::SEATED, true) && $seat < $game->seats;

                // Overflow can't go to a wait list the new event doesn't have.
                if (! $seated && ! $game->hasWaitlist()) {
                    continue;
                }

                GamePlayer::create([
                    'discussion_id' => $new->id,
                    'user_id' => $row->user_id,
                    'guest_name' => $row->guest_name,
                    'status' => $seated ? 'invited' : 'waitlist',
                    'position' => $seated ? ++$seat : ++$line,
                    'note' => $row->note,
                ]);

                if ($seated && $row->user) {
                    $invited[] = $row->user;
                }
            }

            // Only seated players are told; the wait list is copied silently.
            $this->notify($new, $invited, 'invited', $actor);
        }

        $this->fillSeats($new, $game);
    }

    // ---------------------------------------------------------- seat filling

    /**
     * Expire seat offers that weren't answered in time (the seat goes back to
     * open; the host decides who to offer it to next). Runs whenever the list is
     * viewed or changed, so no cron is needed.
     */
    public function fillSeats(Discussion $discussion, Game $game, int $opened = 0): void
    {
        $eventAt = $this->eventAt($discussion);

        if ($eventAt && $eventAt->isPast()) {
            return;
        }

        $host = $discussion->user;

        $expired = GamePlayer::with('user')
            ->where('discussion_id', $discussion->id)
            ->where('status', 'offered')
            ->where('offer_expires_at', '<', Carbon::now())
            ->get();

        foreach ($expired as $row) {
            $row->status = 'expired';
            $row->offer_expires_at = null;
            $row->save();

            $this->notify($discussion, [$row->user], 'expired', $host);
            $this->notify($discussion, [$host], 'expired_host', $row->user);
        }

        // No offers at all: the host moves wait-listed players into the game by
        // hand ("Add to game"), and they confirm like anyone else.
    }

    // ---------------------------------------------------------------- helpers

    protected function freeSeats(Discussion $discussion, Game $game): int
    {
        $seated = GamePlayer::where('discussion_id', $discussion->id)->whereIn('status', self::SEATED)->count();

        return $game->seats - $seated;
    }

    protected function requireFreeSeat(Discussion $discussion, Game $game): void
    {
        if ($this->freeSeats($discussion, $game) <= 0) {
            $this->fail('no_open_spots');
        }
    }

    protected function nextPosition(Discussion $discussion, array $statuses): int
    {
        return (int) GamePlayer::where('discussion_id', $discussion->id)->whereIn('status', $statuses)->max('position') + 1;
    }

    protected function findRow(Discussion $discussion, int $userId): ?GamePlayer
    {
        return GamePlayer::where('discussion_id', $discussion->id)->where('user_id', $userId)->first();
    }

    protected function ownRow(User $actor, Discussion $discussion, array $statuses): GamePlayer
    {
        $row = $this->findRow($discussion, $actor->id);

        if (! $row || ! in_array($row->status, $statuses, true)) {
            $this->fail('list_changed');
        }

        return $row;
    }

    protected function notify(Discussion $discussion, array $users, string $kind, ?User $from, array $extra = []): void
    {
        $users = array_values(array_filter(
            $users,
            fn ($u) => $u instanceof User && (! $from || (int) $u->id !== (int) $from->id)
        ));

        if (! $users) {
            return;
        }

        // A notification problem (e.g. a member with an invalid email address)
        // must never undo or block the change to the list itself.
        try {
            $this->notifications->sync(new GameNotificationBlueprint($discussion, $from, $kind, $extra), $users);
        } catch (\Throwable $e) {
            resolve(LoggerInterface::class)->warning('[events-calendar] game notification failed: '.$e->getMessage());
        }
    }

    protected function requireHost(bool $isHost): void
    {
        if (! $isHost) {
            throw new PermissionDeniedException();
        }
    }

    /**
     * Stop with a message for the user, from the `api` texts, with the forum's words filled in.
     */
    protected function fail(string $key, array $params = []): never
    {
        $message = resolve(TranslatorInterface::class)->trans(
            'mrcaspan-flarum2-events-calendar.api.'.$key,
            $params + Words::params($this->settings)
        );

        throw new ValidationException(['players' => $message]);
    }
}
