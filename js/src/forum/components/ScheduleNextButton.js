import app from 'flarum/forum/app';
import trans from '../utils/trans';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import ScheduleNextGameModal from './ScheduleNextGameModal';

/** Host-only "Schedule next game" button in the discussion sidebar. */
export default class ScheduleNextButton extends Component {
  view() {
    return (
      <Button
        className="Button Button--primary ScheduleNextButton"
        icon="fas fa-calendar-plus"
        onclick={() => app.modal.show(ScheduleNextGameModal, { discussion: this.attrs.discussion })}
      >
        {trans('forum.players.schedule_next_button')}
      </Button>
    );
  }
}
