import app from 'flarum/forum/app';
import trans from '../utils/trans';
import FormModal from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Stream from 'flarum/common/utils/Stream';
import extractText from 'flarum/common/utils/extractText';
import { toLocalInput, localInputToIso } from '../utils/eventsTag';
import DateTimePicker from './DateTimePicker';

export default class EditEventDateModal extends FormModal {
  oninit(vnode) {
    super.oninit(vnode);
    this.eventAt = Stream(toLocalInput(this.attrs.discussion.eventAt && this.attrs.discussion.eventAt()));
  }

  className() {
    return 'EditEventDateModal Modal--small';
  }

  title() {
    return trans('forum.banner.edit_title');
  }

  content() {
    const hadDate = !!(this.attrs.discussion.eventAt && this.attrs.discussion.eventAt());

    return (
      <div className="Modal-body">
        <div className="Form-group">
          <label>{trans('forum.composer.event_when')}</label>
          <DateTimePicker value={this.eventAt} boxed />
        </div>
        <div className="EditEventDateModal-actions">
          {hadDate && !app.forum.attribute('eventsCalendar.requireDate') ? (
            <Button
              type="button"
              className="Button EditEventDateModal-delete"
              icon="fas fa-trash-alt"
              onclick={this.clearDate.bind(this)}
              loading={this.clearing}
              disabled={this.loading}
            >
              {trans('forum.banner.delete')}
            </Button>
          ) : null}
          <Button type="submit" className="Button Button--primary" loading={this.loading} disabled={!this.eventAt() || this.clearing}>
            {trans('forum.banner.save')}
          </Button>
        </div>
      </div>
    );
  }

  async onsubmit(e) {
    e.preventDefault();

    const iso = localInputToIso(this.eventAt());
    if (!iso) return;

    this.loading = true;
    try {
      await this.attrs.discussion.save({ eventAt: iso });
      this.hide();
    } finally {
      this.loading = false;
      m.redraw();
    }
  }

  async clearDate() {
    if (!confirm(extractText(trans('forum.banner.clear_confirm')))) return;

    this.clearing = true;
    try {
      await this.attrs.discussion.save({ eventAt: null });
      this.hide();
    } finally {
      this.clearing = false;
      m.redraw();
    }
  }
}
