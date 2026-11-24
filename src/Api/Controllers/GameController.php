<?php

namespace MrCaspan\EventsCalendar\Api\Controllers;

use Flarum\Discussion\Discussion;
use Flarum\Http\RequestUtil;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use MrCaspan\EventsCalendar\Game\GameService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET  /api/events-calendar/{id}  the game's player list
 * POST /api/events-calendar/{id}  { action, ... } change it, returns the updated list
 */
class GameController implements RequestHandlerInterface
{
    public function __construct(protected GameService $games)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $discussion = Discussion::whereVisibleTo($actor)->findOrFail(self::routeId($request));

        if ($request->getMethod() === 'POST') {
            $body = (array) $request->getParsedBody();

            if (Arr::get($body, 'action') === 'scheduleNext') {
                $new = $this->games->scheduleNext($actor, $discussion, $body, $request);

                return new JsonResponse(['discussion' => ['id' => (int) $new->id, 'slug' => $new->slug]]);
            }

            $this->games->act($actor, $discussion, (string) Arr::get($body, 'action', ''), $body);
            $discussion = $discussion->fresh();
        }

        return new JsonResponse($this->games->serialize($actor, $discussion));
    }

    public static function routeId(ServerRequestInterface $request): int
    {
        return (int) (Arr::get((array) $request->getAttribute('routeParameters'), 'id')
            ?? Arr::get($request->getQueryParams(), 'id'));
    }
}
