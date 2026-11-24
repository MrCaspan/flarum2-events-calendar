<?php

namespace MrCaspan\EventsCalendar\Api;

use Carbon\Carbon;
use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Tags\Tag;
use Flarum\User\User;
use Illuminate\Support\Arr;
use MrCaspan\EventsCalendar\DiscussionEvent;
use MrCaspan\EventsCalendar\Game\Game;
use MrCaspan\EventsCalendar\Words;

/**
 * Adds the writable `eventAt` attribute to discussions.
 *
 * Replaces the 1.x SaveEventAt listener and the event_at serializer attribute.
 */
class DiscussionResourceFields
{
    public function __invoke(): array
    {
        return [
            Schema\DateTime::make('eventAt')
                ->nullable()
                // "Every event must have a date and time" (admin setting): a new
                // discussion in the events tag can't be started without one.
                ->required(fn (Context $context) => $context->creating() && $this->dateRequired() && $this->sentInEventsTag($context))
                ->validationMessages([
                    'eventAt.required' => resolve(TranslatorInterface::class)->trans('mrcaspan-flarum2-events-calendar.api.date_required', Words::params(resolve(SettingsRepositoryInterface::class))),
                ])
                ->get(fn (Discussion $discussion) => $discussion->discussionEvent?->event_at)
                ->writable(function (Discussion $discussion, Context $context) {
                    // Anyone allowed to start the discussion may date it; afterwards
                    // only the author or someone who can rename the discussion.
                    return $context->creating() || $this->canEditEvent($context->getActor(), $discussion);
                })
                ->set(function (Discussion $discussion, mixed $value, Context $context) {
                    // Only a discussion in the events tag may carry a date. On create the
                    // discussion's tags are not saved yet, so also accept the tags sent
                    // with this same request.
                    $inEventsTag = $this->isInEventsTag($discussion, $context);

                    // With dates required, an event's date can be changed but not removed.
                    if ($value === null && $inEventsTag && $this->dateRequired()) {
                        throw new ValidationException([
                            'eventAt' => resolve(TranslatorInterface::class)->trans('mrcaspan-flarum2-events-calendar.api.date_required', Words::params(resolve(SettingsRepositoryInterface::class))),
                        ]);
                    }

                    // An event with an attendee list keeps its date (it can be changed,
                    // not removed), so nobody's RSVP ends up on an undated discussion.
                    if ($value === null && $discussion->exists && Game::where('discussion_id', $discussion->id)->exists()) {
                        throw new ValidationException([
                            'eventAt' => resolve(TranslatorInterface::class)->trans('mrcaspan-flarum2-events-calendar.api.date_has_list', Words::params(resolve(SettingsRepositoryInterface::class))),
                        ]);
                    }

                    // The discussion row must exist before the event row can point at it.
                    $discussion->afterSave(function (Discussion $discussion) use ($value, $inEventsTag) {
                        if ($value === null) {
                            DiscussionEvent::where('discussion_id', $discussion->id)->delete();
                        } elseif ($inEventsTag) {
                            DiscussionEvent::updateOrCreate(
                                ['discussion_id' => $discussion->id],
                                ['event_at' => Carbon::instance($value)->utc()]
                            );
                        }

                        $discussion->unsetRelation('discussionEvent');
                    });
                }),
        ];
    }

    protected function canEditEvent(User $actor, Discussion $discussion): bool
    {
        if ($actor->isGuest()) {
            return false;
        }

        return $actor->can('rename', $discussion) || (int) $discussion->user_id === (int) $actor->id;
    }

    protected function dateRequired(): bool
    {
        return (bool) resolve(SettingsRepositoryInterface::class)->get('mrcaspan-events-calendar.require_date', false);
    }

    protected function eventsTag(): ?Tag
    {
        $slug = (string) resolve(SettingsRepositoryInterface::class)->get('mrcaspan-events-calendar.events_tag', '');

        return $slug === '' ? null : Tag::where('slug', $slug)->first();
    }

    /** Whether the events tag is among the tags sent with this request. */
    protected function sentInEventsTag(Context $context): bool
    {
        $tag = $this->eventsTag();

        if (! $tag) {
            return false;
        }

        $sentTagIds = array_map(
            'intval',
            array_column((array) Arr::get($context->body() ?? [], 'data.relationships.tags.data', []), 'id')
        );

        return in_array((int) $tag->id, $sentTagIds, true);
    }

    protected function isInEventsTag(Discussion $discussion, Context $context): bool
    {
        $tag = $this->eventsTag();

        if (! $tag) {
            return false;
        }

        if ($this->sentInEventsTag($context)) {
            return true;
        }

        return $discussion->exists && $discussion->tags()->where('tags.id', $tag->id)->exists();
    }
}
