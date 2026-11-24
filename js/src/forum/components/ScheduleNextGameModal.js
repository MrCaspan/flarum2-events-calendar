import app from 'flarum/forum/app';
import trans from '../utils/trans';
import FormModal from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Stream from 'flarum/common/utils/Stream';
import { toLocalInput, localInputToIso } from '../utils/eventsTag';
import { gameAction, loadGame } from '../utils/gameApi';
import DateTimePicker from './DateTimePicker';

const t = (key, params) => trans('forum.schedule_next.' + key, params);

/** "Game 29" -> "Game 30": bump the last number in the title, if there is one. */
function nextTitle(title) {
  return (title || '').replace(/(\d+)(?!.*\d)/, (n) => String(parseInt(n, 10) + 1));
}

/**
 * Always count from the date of the game being copied (the host's choice), even
 * if it is already over. Only a game with no date falls back to today, 6:30 PM.
 */
function baseDate(eventAt) {
  if (eventAt) return new Date(eventAt.getTime());

  const d = new Date();
  d.setHours(18, 30, 0, 0);
  return d;
}

function addWeeks(date, weeks) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + 7 * weeks);
  return d;
}

/**
 * Host-only: copy this game (title, first post, tags, players list settings)
 * into a new discussion with a new date, optionally bringing the players along.
 */
export default class ScheduleNextGameModal extends FormModal {
  oninit(vnode) {
    super.oninit(vnode);
    const discussion = this.attrs.discussion;

    this.gameTitle = Stream(nextTitle(discussion.title()));
    // Default: one week after the game being copied.
    this.base = baseDate(discussion.eventAt && discussion.eventAt());
    this.eventAt = Stream(toLocalInput(addWeeks(this.base, 1)));
    this.copyPlayers = Stream(true);
    this.copyWaitlist = Stream(true);

    // Whether this game has a players list decides if "Copy players list" shows.
    this.game = this.attrs.game || null;
    if (!this.game) {
      loadGame(discussion.id())
        .then((game) => (this.game = game))
        .catch(() => (this.game = { enabled: false }))
        .finally(() => m.redraw());
    }
  }

  className() {
    return 'ScheduleNextGameModal Modal--small';
  }

  title() {
    return t('title');
  }

  content() {
    const hasList = this.game && this.game.enabled;

    return (
      <div className="Modal-body">
        <p className="helpText ScheduleNextGameModal-intro">{t('help')}</p>
        <div className="Form-group">
          <label>{t('game_title')}</label>
          <input className="FormControl" bidi={this.gameTitle} />
        </div>
        <div className="Form-group">
          <label>{trans('forum.composer.event_when')}</label>
          <DateTimePicker value={this.eventAt} boxed />
          <div className="ScheduleNextGameModal-quick">
            {[1, 2, 3, 4].map((weeks) => {
              const date = addWeeks(this.base, weeks);
              const value = toLocalInput(date);

              return (
                <button
                  type="button"
                  className={'Button ScheduleNextGameModal-quickBtn' + (this.eventAt() === value ? ' active' : '')}
                  onclick={() => this.eventAt(value)}
                >
                  <span className="ScheduleNextGameModal-quickWeeks">{t('weeks', { count: weeks })}</span>
                  <span className="ScheduleNextGameModal-quickDate">{dayjs(date).format('MMM D')}</span>
                </button>
              );
            })}
          </div>
        </div>
        {hasList && (
          <div className="Form-group ScheduleNextGameModal-copy">
            <label className="checkbox">
              <input type="checkbox" checked={this.copyPlayers()} onchange={(e) => this.copyPlayers(e.target.checked)} />
              {t('copy_players')}
            </label>
            <p className="helpText">{t('copy_players_help')}</p>

            <label className="checkbox">
              <input type="checkbox" checked={this.copyWaitlist()} onchange={(e) => this.copyWaitlist(e.target.checked)} />
              {t('copy_waitlist')}
            </label>
            <p className="helpText">{t('copy_waitlist_help')}</p>
          </div>
        )}
        <div className="ScheduleNextGameModal-actions">
          <Button type="submit" className="Button Button--primary" icon="fas fa-calendar-plus" loading={this.loading} disabled={!this.gameTitle().trim() || !this.eventAt()}>
            {t('submit')}
          </Button>
        </div>
      </div>
    );
  }

  async onsubmit(e) {
    e.preventDefault();

    const iso = localInputToIso(this.eventAt());
    if (!iso || !this.gameTitle().trim()) return;

    this.loading = true;
    m.redraw();

    try {
      const result = await gameAction(this.attrs.discussion.id(), {
        action: 'scheduleNext',
        title: this.gameTitle().trim(),
        eventAt: iso,
        copyPlayers: !!(this.game && this.game.enabled && this.copyPlayers()),
        copyWaitlist: !!(this.game && this.game.enabled && this.copyWaitlist()),
      });

      this.hide();
      const d = result.discussion;
      m.route.set(app.route('discussion', { id: d.id + (d.slug ? '-' + d.slug : '') }));
    } finally {
      this.loading = false;
      m.redraw();
    }
  }
}
