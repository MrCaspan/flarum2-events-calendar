<?php

namespace MrCaspan\EventsCalendar\Game;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\Discussion\Discussion;
use Flarum\Locale\TranslatorInterface;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Notification\MailableInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use MrCaspan\EventsCalendar\Words;

/**
 * One notification type for everything on a game's player list; `kind` in the
 * data says what happened (invited, offered, request, accepted, ...).
 */
class GameNotificationBlueprint implements BlueprintInterface, AlertableInterface, MailableInterface
{
    protected array $data;

    public function __construct(
        public Discussion $discussion,
        public ?User $actor,
        public string $kind,
        array $extra = []
    ) {
        // A unique stamp so each send is a new notification: the syncer otherwise
        // treats identical blueprints as one and removes it from earlier recipients.
        $this->data = array_merge(['kind' => $kind, 'stamp' => uniqid('', true)], $extra);
    }

    public function getFromUser(): ?User
    {
        return $this->actor;
    }

    public function getSubject(): ?AbstractModel
    {
        return $this->discussion;
    }

    public function getData(): mixed
    {
        return $this->data;
    }

    public static function getType(): string
    {
        return 'eventsCalendarAttendees';
    }

    public static function getSubjectModel(): string
    {
        return Discussion::class;
    }

    public function getEmailViews(): array
    {
        return [
            'text' => 'events-calendar::emails.plain.game',
            'html' => 'events-calendar::emails.html.game',
        ];
    }

    public function getEmailSubject(TranslatorInterface $translator): string
    {
        return $translator->trans('mrcaspan-flarum2-events-calendar.email.'.$this->kind.'.subject', $this->emailParams());
    }

    /** Placeholders for the email subject and body. */
    public function emailParams(): array
    {
        $hours = null;
        if (! empty($this->data['expires'])) {
            $hours = max(1, (int) round((Carbon::parse($this->data['expires'])->getTimestamp() - time()) / 3600));
        }

        return [
            '{actor}' => $this->actor?->display_name ?? '',
            '{title}' => $this->discussion->title,
            '{hours}' => (string) ($hours ?? ''),
        ] + Words::params(resolve(SettingsRepositoryInterface::class));
    }
}
