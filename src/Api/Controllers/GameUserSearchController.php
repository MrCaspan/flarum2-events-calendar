<?php

namespace MrCaspan\EventsCalendar\Api\Controllers;

use Flarum\Discussion\Discussion;
use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use MrCaspan\EventsCalendar\Game\GameService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET /api/events-calendar/{id}/users?q=...
 *
 * Member lookup for the host's "Add player" box. Hosts are ordinary members who
 * may not have the core user-search permission, so this is limited to hosts of
 * this game and returns only public profile basics.
 */
class GameUserSearchController implements RequestHandlerInterface
{
    public function __construct(protected GameService $games, protected ConnectionInterface $db)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $discussion = Discussion::whereVisibleTo($actor)->findOrFail(GameController::routeId($request));

        if (! $this->games->isHost($actor, $discussion)) {
            throw new PermissionDeniedException();
        }

        $q = trim((string) Arr::get($request->getQueryParams(), 'q', ''));
        if ($q === '') {
            return new JsonResponse([]);
        }

        $like = addcslashes($q, '%_\\').'%';
        $hasNickname = $this->db->getSchemaBuilder()->hasColumn('users', 'nickname');

        $users = User::query()
            ->where(function ($query) use ($like, $hasNickname) {
                $query->where('username', 'like', $like);
                if ($hasNickname) {
                    $query->orWhere('nickname', 'like', $like);
                }
            })
            ->orderByRaw('LENGTH(username)')
            ->limit(8)
            ->get();

        return new JsonResponse($users->map(fn (User $u) => $this->games->serializeUser($u))->values());
    }
}
