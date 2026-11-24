import app from 'flarum/forum/app';
import trans from '../utils/trans';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import fullTime from 'flarum/common/helpers/fullTime';
import EditEventDateModal from './EditEventDateModal';
import { canEditEvent } from '../utils/eventsTag';

export default class EventBanner extends Component {
  view() {
    const discussion = this.attrs.discussion;
    const eventAt = discussion.eventAt && discussion.eventAt();
    const canEdit = canEditEvent(discussion);

    if (!eventAt && !canEdit) return null;

    const label = trans('forum.banner.' + (eventAt ? 'edit' : 'add'));

    return (
      <div className={'EventBanner' + (eventAt ? '' : ' EventBanner--unset')}>
        <i className="icon fas fa-calendar-alt EventBanner-icon" aria-hidden="true" />
        <div className="EventBanner-content">
          {eventAt ? (
            [
              <div key="label" className="EventBanner-label">
                {trans('forum.banner.when')}
              </div>,
              <div key="date" className="EventBanner-date">
                {fullTime(eventAt)}
              </div>,
            ]
          ) : (
            <div className="EventBanner-date">{trans('forum.banner.no_date')}</div>
          )}
        </div>
        {canEdit && (
          <Button
            className={'Button ' + (eventAt ? 'Button--icon' : 'Button--primary')}
            icon={eventAt ? 'fas fa-pen' : 'fas fa-plus'}
            onclick={() => app.modal.show(EditEventDateModal, { discussion })}
            aria-label={label}
            title={label}
          >
            {!eventAt && label}
          </Button>
        )}
      </div>
    );
  }
}
