<?php

namespace MrCaspan\EventsCalendar\Api\Controllers;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Tags\Tag;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET /api/calendar?start=...&end=...
 *
 * Returns the dated discussions in the events tag that the current user is
 * allowed to see, for FullCalendar.
 */
class CalendarListController implements RequestHandlerInterface
{
    public function __construct(protected SettingsRepositoryInterface $settings)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $tagSlug = (string) $this->settings->get('mrcaspan-events-calendar.events_tag', '');

        if ($tagSlug === '') {
            return new JsonResponse([]);
        }

        $tag = Tag::where('slug', $tagSlug)->first();
        if (! $tag) {
            return new JsonResponse([]);
        }

        $params = $request->getQueryParams();
        // Event times are stored in UTC; FullCalendar sends local times with an offset.
        $start = Carbon::parse(Arr::get($params, 'start', Carbon::now()->startOfMonth()))->utc();
        $end = Carbon::parse(Arr::get($params, 'end', Carbon::now()->endOfMonth()))->utc();

        $rows = Discussion::whereVisibleTo($actor)
            ->join('events_calendar_dates', 'events_calendar_dates.discussion_id', '=', 'discussions.id')
            ->join('discussion_tag', 'discussion_tag.discussion_id', '=', 'discussions.id')
            ->where('discussion_tag.tag_id', $tag->id)
            ->whereNull('discussions.hidden_at')
            ->whereBetween('events_calendar_dates.event_at', [$start, $end])
            ->select('discussions.id', 'discussions.title', 'discussions.slug', 'events_calendar_dates.event_at')
            ->orderBy('events_calendar_dates.event_at')
            ->get();

        $data = $rows->map(fn ($row) => [
            'id' => (int) $row->id,
            'title' => $row->title,
            'slug' => $row->slug,
            'event_at' => Carbon::parse($row->getRawOriginal('event_at'), 'UTC')->toIso8601String(),
            'url' => '/d/'.$row->id.'-'.$row->slug,
        ]);

        return new JsonResponse($data->values());
    }
}
