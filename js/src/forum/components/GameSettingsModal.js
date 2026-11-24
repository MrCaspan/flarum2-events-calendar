import app from 'flarum/forum/app';
import trans from '../utils/trans';
import FormModal from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Stream from 'flarum/common/utils/Stream';
import extractText from 'flarum/common/utils/extractText';
import { gameAction } from '../utils/gameApi';

const t = (key, params) => trans('forum.players.' + key, params);

/** Host settings for a game's player list: seats, minimum, requests, remove. */
export default class GameSettingsModal extends FormModal {
  oninit(vnode) {
    super.oninit(vnode);
    const game = this.attrs.game || {};

    this.isNew = !game.enabled;
    this.seats = Stream(String(game.seats || 10));
    this.minPlayers = Stream(game.minPlayers ? String(game.minPlayers) : '');
    this.allowRequests = Stream(game.enabled ? !!game.allowRequests : true);  }

  className() {
    return 'GameSettingsModal Modal--small';
  }

  title() {
    return t(this.isNew ? 'setup_title' : 'settings_title');
  }

  content() {
    return (
      <div className="Modal-body">
        <div className="Form-group">
          <label>{t('seats')}</label>
          <input className="FormControl" type="number" min="1" max="100" bidi={this.seats} />
        </div>
        <div className="Form-group">
          <label>{t('min_players')}</label>
          <input className="FormControl" type="number" min="0" max="100" placeholder={extractText(t('min_players_placeholder'))} bidi={this.minPlayers} />
        </div>
        <div className="Form-group">
          <label className="checkbox">
            <input type="checkbox" checked={this.allowRequests()} onchange={(e) => this.allowRequests(e.target.checked)} />
            {t('allow_requests')}
          </label>
          <p className="helpText">{t('allow_requests_help')}</p>
        </div>
        <div className="GameSettingsModal-actions">
          {!this.isNew && (
            <Button type="button" className="Button GameSettingsModal-delete" icon="fas fa-trash-alt" onclick={this.remove.bind(this)} disabled={this.loading}>
              {t('remove_list')}
            </Button>
          )}
          <Button type="submit" className="Button Button--primary" loading={this.loading}>
            {t(this.isNew ? 'create' : 'save')}
          </Button>
        </div>
      </div>
    );
  }

  async onsubmit(e) {
    e.preventDefault();
    this.loading = true;

    try {
      const game = await gameAction(this.attrs.discussion.id(), {
        action: 'settings',
        seats: parseInt(this.seats(), 10) || 10,
        minPlayers: parseInt(this.minPlayers(), 10) || null,
        allowRequests: this.allowRequests(),
      });
      this.attrs.onsave(game);
      this.hide();
    } finally {
      this.loading = false;
      m.redraw();
    }
  }

  async remove() {
    if (!confirm(extractText(t('remove_confirm')))) return;
    this.loading = true;

    try {
      const game = await gameAction(this.attrs.discussion.id(), { action: 'disable' });
      this.attrs.onsave(game);
      this.hide();
    } finally {
      this.loading = false;
      m.redraw();
    }
  }
}
