import app from 'flarum/forum/app';
import trans, { fillWords } from '../utils/trans';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import extractText from 'flarum/common/utils/extractText';
import stringToColor from 'flarum/common/utils/stringToColor';
import GameSettingsModal from './GameSettingsModal';
import { loadGame, gameAction, searchMembers } from '../utils/gameApi';
import { bumpGameVersion } from '../utils/gameVersion';

const SEATED = ['confirmed', 'invited', 'offered'];
const t = (key, params) => trans('forum.players.' + key, params);

function formatTime(iso) {
  return iso ? dayjs(iso).format('ddd MMM D, h:mm A') : '';
}

/**
 * The game's player list, shown under the game description in the first post:
 * numbered seats, waitlist, requests, the viewer's own buttons, and host tools.
 */
export default class GamePlayers extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.game = null;
    this.busy = false;
    this.query = '';
    this.results = [];
    this.searchTimer = null;
    this.adding = null; // { key, toWaitlist } while a row shows the inline search
    this.load();
  }

  /** Redraw through the first post's subtree check (see utils/gameVersion). */
  redraw() {
    bumpGameVersion();
    m.redraw();
  }

  discussionId() {
    return this.attrs.discussion.id();
  }

  async load() {
    try {
      this.game = await loadGame(this.discussionId());
    } catch (e) {
      this.game = { enabled: false };
    }
    this.redraw();
  }

  async act(body) {
    if (this.busy) return;
    this.busy = true;
    this.redraw();

    try {
      this.game = await gameAction(this.discussionId(), body);
    } catch (e) {
      // app.request already shows the error; reload in case the list moved on.
      this.load();
    } finally {
      this.busy = false;
      this.redraw();
    }
  }

  openSettings() {
    app.modal.show(GameSettingsModal, {
      discussion: this.attrs.discussion,
      game: this.game,
      onsave: (game) => {
        this.game = game;
        this.redraw();
      },
    });
  }

  view() {
    const game = this.game;

    if (!game) return <div className="GamePlayers GamePlayers--loading"><LoadingIndicator size="small" display="inline" /></div>;

    return this.box(game);
  }

  box(game) {
    if (!game.enabled) {
      if (!game.canSetup) return null;

      // It isn't an event until it has a date: no list before that.
      const discussion = this.attrs.discussion;
      if (!(discussion.eventAt && discussion.eventAt())) {
        return (
          <div className="GamePlayers GamePlayers--setup GamePlayers--needsDate">
            <i className="fas fa-calendar-alt GamePlayers-setupIcon" aria-hidden="true" />
            <span>{t('needs_date')}</span>
          </div>
        );
      }

      return (
        <div className="GamePlayers GamePlayers--setup">
          <i className="fas fa-users GamePlayers-setupIcon" aria-hidden="true" />
          <span>{t('setup_prompt')}</span>
          <Button className="Button Button--primary" icon="fas fa-plus" onclick={this.openSettings.bind(this)}>
            {t('setup_button')}
          </Button>
        </div>
      );
    }

    const players = game.players || [];
    const seated = players.filter((p) => SEATED.includes(p.status));
    const waitlist = players.filter((p) => p.status === 'waitlist');
    const requests = players.filter((p) => p.status === 'requested');
    const out = players.filter((p) => p.status === 'declined' || p.status === 'expired');
    const confirmed = seated.filter((p) => p.status === 'confirmed').length;
    const openSeats = Math.max(0, game.seats - seated.length);

    return (
      // Any click or typing inside also redraws the retained post.
      <div className={'GamePlayers' + (this.busy ? ' GamePlayers--busy' : '')} onclick={bumpGameVersion} oninput={bumpGameVersion}>
        <div className="GamePlayers-header">
          <h3 className="GamePlayers-title">
            <i className="fas fa-users" aria-hidden="true" /> {t('title')}
          </h3>
          <span className="GamePlayers-count">{t('count', { taken: seated.length, seats: game.seats })}</span>
          {this.minPlayersNote(game, confirmed)}
          {game.isHost && (
            <Button className="Button Button--icon Button--flat GamePlayers-settings" icon="fas fa-cog" onclick={this.openSettings.bind(this)} aria-label={extractText(t('settings_title'))} />
          )}
        </div>

        <ul className="GamePlayers-list">
          {[
            ...seated.map((p, i) => this.row(p, game, i + 1)),
            ...Array.from({ length: openSeats }, (_, i) => this.addRow(game, 'open' + i, seated.length + i + 1, false, t('open_seat'))),
          ]}
        </ul>

        {/* With a wait list on, the host always gets it with an "Add to wait list" spot at the bottom.
            With it off, people already on it (from before it was switched off) still show, so the host can move them. */}
        {(waitlist.length > 0 || (game.isHost && game.waitlist)) && [
          <h4 key="wh" className="GamePlayers-subtitle"><i className="fas fa-user-clock" aria-hidden="true" /> {t('waitlist')}</h4>,
          <ul key="wl" className="GamePlayers-list GamePlayers-list--waitlist">
            {/* One keyed array: a keyed <li> next to an unkeyed fragment makes Mithril throw. */}
            {[
              ...waitlist.map((p, i) => this.row(p, game, i + 1)),
              ...(game.isHost && game.waitlist ? [this.addRow(game, 'wait', waitlist.length + 1, true, t('add_to_waitlist'))] : []),
            ]}
          </ul>,
        ]}

        {requests.length > 0 && [
          <h4 key="rh" className="GamePlayers-subtitle"><i className="fas fa-hand-paper" aria-hidden="true" /> {t('requests')}</h4>,
          <ul key="rl" className="GamePlayers-list">
            {requests.map((p) => this.row(p, game))}
          </ul>,
        ]}

        {out.length > 0 && game.isHost && [
          <h4 key="oh" className="GamePlayers-subtitle"><i className="fas fa-user-slash" aria-hidden="true" /> {t('out')}</h4>,
          <ul key="ol" className="GamePlayers-list GamePlayers-list--out">
            {out.map((p) => this.row(p, game))}
          </ul>,
        ]}

        {this.myActions(game, openSeats)}
      </div>
    );
  }

  /**
   * An "Open seat" / "Add to wait list" row. For the host, clicking it turns the
   * row into a username search right there; picking a member adds them.
   */
  addRow(game, key, number, toWaitlist, label) {
    const active = this.adding && this.adding.key === key;

    return (
      <li key={key} className={'GamePlayers-row GamePlayers-row--open' + (game.isHost ? ' GamePlayers-row--add' : '')}>
        <span className="GamePlayers-pillSlot" />
        <span className="GamePlayers-num">{number}.</span>
        {active ? (
          this.inlineSearch()
        ) : game.isHost ? (
          <button type="button" className="GamePlayers-addBtn" onclick={() => this.startAdding(key, toWaitlist)}>
            {label}
          </button>
        ) : (
          <span className="GamePlayers-openLabel">{label}</span>
        )}
      </li>
    );
  }

  startAdding(key, toWaitlist) {
    this.adding = { key, toWaitlist };
    this.query = '';
    this.results = [];
  }

  stopAdding() {
    this.adding = null;
    this.query = '';
    this.results = [];
    clearTimeout(this.searchTimer);
  }

  inlineSearch() {
    return (
      <div className="GamePlayers-inlineSearch">
        <div className="GamePlayers-inlineField">
          <i className="fas fa-search" aria-hidden="true" />
          <input
            className="FormControl"
            type="search"
            placeholder={extractText(t('invite_placeholder'))}
            value={this.query}
            oncreate={(vnode) => vnode.dom.focus()}
            oninput={(e) => this.search(e.target.value)}
            onkeydown={(e) => {
              if (e.key === 'Escape') this.stopAdding();
            }}
          />
          <button type="button" className="GamePlayers-inlineClose" aria-label={extractText(t('cancel'))} onclick={() => this.stopAdding()}>
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>
        {this.results.length > 0 && (
          <ul className="Dropdown-menu GamePlayers-results">
            {this.results.map((u) => (
              <li key={u.id} className="GamePlayers-result">
                <button type="button" className="hasIcon GamePlayers-resultMain" onclick={() => this.invite(u, this.adding.toWaitlist)}>
                  {this.avatar(u)}
                  <span className="GamePlayers-name">{u.displayName}</span>
                  {u.displayName !== u.username && <span className="GamePlayers-username">@{u.username}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  minPlayersNote(game, confirmed) {
    if (!game.minPlayers) return null;
    const need = game.minPlayers - confirmed;
    // The admin's own go-ahead message, if set (Admin > Events Calendar).
    const custom = String(app.forum.attribute('eventsCalendar.goMessage') || '').trim();

    return need > 0 ? (
      <span className="GamePlayers-min">{t('need_more', { count: need })}</span>
    ) : (
      <span className="GamePlayers-min GamePlayers-min--on">
        <i className="fas fa-check" aria-hidden="true" /> {custom ? fillWords(custom) : t('game_on')}
      </span>
    );
  }

  avatar(user) {
    if (user.avatarUrl) return <img className="Avatar GamePlayers-avatar" src={user.avatarUrl} alt="" loading="lazy" />;

    const name = user.displayName || user.username || '?';
    return (
      <span className="Avatar GamePlayers-avatar" style={{ background: '#' + stringToColor(name) }}>
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  /** Text and tooltip for a player's status pill. */
  pill(p) {
    switch (p.status) {
      case 'confirmed':
        return { label: t('status.in'), title: t('status.confirmed') };
      case 'invited':
        return { label: '…', title: t('status.invited') };
      case 'offered':
        return { label: t('status.pill_offer'), title: t('status.offered', { time: formatTime(p.offerExpiresAt) }) };
      case 'requested':
        return { label: t('status.pill_requested'), title: t('status.requested') };
      case 'declined':
        return { label: t('status.pill_out'), title: t('status.declined') };
      case 'expired':
        return { label: t('status.pill_missed'), title: t('status.expired') };
      case 'waitlist':
        return { label: '…', title: t('waitlist') };
      default:
        return null;
    }
  }

  /** The status pill; for the host it is also the button that opens the player menu. */
  status(p, game) {
    const pill = this.pill(p);
    if (!pill) return null;

    const className = 'GamePlayers-pill GamePlayers-pill--' + p.status;
    const title = extractText(pill.title);

    if (!game.isHost) {
      // Players on the wait list are already under the "Wait list" heading.
      if (p.status === 'waitlist') return null;

      // Public view: no pill for undecided players (a pill means "clickable"
      // to the host), just plain grey "TBD".
      if (p.status === 'invited' || p.status === 'offered') {
        return (
          <span className="GamePlayers-tbd" title={title}>
            {t('status.tbd')}
          </span>
        );
      }

      return (
        <span className={className} title={title}>
          {pill.label}
        </span>
      );
    }

    return (
      <Dropdown
        className="GamePlayers-menu"
        buttonClassName={className}
        menuClassName="Dropdown-menu--right"
        label={pill.label}
        caretIcon=""
        buttonAttrs={{ title }}
        accessibleToggleLabel={extractText(t('host_menu.label')) + ': ' + title}
      >
        {this.hostMenuItems(p, game)}
      </Dropdown>
    );
  }

  /** [pill] 1. (avatar) Name (note) — the pill column comes first so it lines up. */
  row(p, game, number) {
    const u = p.user;
    const isMe = app.session.user && app.session.user.id() === String(u.id);
    const isHostRow = u.id === game.hostId;

    return (
      <li key={p.id} className={'GamePlayers-row GamePlayers-row--' + p.status + (isMe ? ' GamePlayers-row--me' : '')}>
        {this.status(p, game) || <span className="GamePlayers-pillSlot" />}
        <span className="GamePlayers-num">{number ? number + '.' : ''}</span>
        <span className="GamePlayers-who">
          <a className="GamePlayers-user" href={app.route('user', { username: u.slug })} route={app.route('user', { username: u.slug })}>
            {this.avatar(u)}
            <span className="GamePlayers-name">{u.displayName}</span>
          </a>
          {(isHostRow || p.note) && (
            <span className="GamePlayers-note">({[isHostRow ? extractText(t('host')) : null, p.note].filter(Boolean).join(', ')})</span>
          )}
        </span>
      </li>
    );
  }

  hostMenuItems(p, game) {
    const seated = SEATED.includes(p.status);
    const run = (action, extra = {}) => () => this.act({ action, playerId: p.id, ...extra });
    const items = [];
    const openSeats = game.seats - (game.players || []).filter((x) => SEATED.includes(x.status)).length;
    const canTakeSeat = !seated && p.status !== 'requested' && openSeats > 0;

    if (p.status === 'requested') items.push(<Button icon="fas fa-check" onclick={run('approve')}>{t('host_menu.approve')}</Button>);
    // Wait-listed players get a seat first ("Give a seat"), then confirm themselves.
    if (!['confirmed', 'requested', 'waitlist'].includes(p.status)) items.push(<Button icon="fas fa-check-circle" onclick={run('confirm')}>{t('host_menu.confirm')}</Button>);
    // Wait list -> game: seated as "…" and asked to confirm, same as adding them by hand.
    if (canTakeSeat) items.push(<Button icon="fas fa-chair" onclick={run('seat')}>{t('host_menu.seat')}</Button>);
    if (p.status !== 'waitlist' && game.waitlist) items.push(<Button icon="fas fa-list-ol" onclick={run('waitlist')}>{t('host_menu.waitlist')}</Button>);
    if (seated || p.status === 'waitlist') {
      items.push(<Button icon="fas fa-arrow-up" onclick={run('up')}>{t('host_menu.up')}</Button>);
      items.push(<Button icon="fas fa-arrow-down" onclick={run('down')}>{t('host_menu.down')}</Button>);
    }
    items.push(
      <Button
        icon="fas fa-tag"
        onclick={() => {
          const note = prompt(extractText(t('host_menu.note_prompt')), p.note || '');
          if (note !== null) this.act({ action: 'note', playerId: p.id, note });
        }}
      >
        {t('host_menu.note')}
      </Button>
    );
    items.push(
      <Button
        icon="fas fa-times"
        className="GamePlayers-remove"
        onclick={() => {
          if (confirm(extractText(t('host_menu.remove_confirm', { name: p.user.displayName })))) this.act({ action: 'remove', playerId: p.id });
        }}
      >
        {t('host_menu.remove')}
      </Button>
    );

    return items;
  }

  myActions(game, openSeats) {
    if (!game.loggedIn) {
      return game.allowRequests ? <p className="GamePlayers-hint">{t('login_to_request')}</p> : null;
    }

    const me = game.me;
    const status = me ? me.status : null;
    const btn = (action, label, icon, primary) => (
      <Button className={'Button' + (primary ? ' Button--primary' : '')} icon={icon} onclick={() => this.act({ action })} disabled={this.busy}>
        {t(label)}
      </Button>
    );

    let content = null;

    if (status === 'invited' || status === 'offered') {
      content = [
        <span className="GamePlayers-prompt">
          {status === 'offered' ? t('you_offered', { time: formatTime(me.offerExpiresAt) }) : t('you_invited')}
        </span>,
        btn('accept', 'im_in', 'fas fa-check', true),
        btn('decline', 'cant_make_it', 'fas fa-times'),
      ];
    } else if (status === 'confirmed') {
      if (game.isHost && game.hostId === Number(app.session.user.id())) return null;
      content = [<span className="GamePlayers-prompt">{t('you_confirmed')}</span>, btn('leave', 'drop_out', 'fas fa-sign-out-alt')];
    } else if (status === 'waitlist') {
      content = [<span className="GamePlayers-prompt">{t('you_waitlisted')}</span>, btn('leave', 'leave_waitlist', 'fas fa-sign-out-alt')];
    } else if (status === 'requested') {
      content = [<span className="GamePlayers-prompt">{t('you_requested')}</span>, btn('cancel', 'cancel_request', 'fas fa-times')];
    } else if (game.allowRequests && !game.isHost && !game.started) {
      if (openSeats > 0) {
        content = btn('request', 'request_seat', 'fas fa-hand-paper', true);
      } else if (game.waitlist) {
        content = btn('request', 'request_waitlist', 'fas fa-hand-paper', true);
      } else {
        content = <span className="GamePlayers-prompt">{t('full_no_waitlist')}</span>;
      }
    }

    return content ? <div className="GamePlayers-actions">{content}</div> : null;
  }

  search(value) {
    this.query = value;
    clearTimeout(this.searchTimer);

    if (!value.trim()) {
      this.results = [];
      return;
    }

    this.searchTimer = setTimeout(async () => {
      const q = value.trim();
      try {
        const results = await searchMembers(this.discussionId(), q);
        if (this.query.trim() === q) this.results = results;
      } catch (e) {
        this.results = [];
      }
      this.redraw();
    }, 250);
  }

  invite(user, toWaitlist) {
    this.stopAdding();
    this.act({ action: 'invite', userId: user.id, toWaitlist: !!toWaitlist });
  }
}
