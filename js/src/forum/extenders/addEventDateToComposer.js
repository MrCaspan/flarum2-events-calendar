import app from 'flarum/forum/app';
import trans from '../utils/trans';
import { extend } from 'flarum/common/extend';
import Stream from 'flarum/common/utils/Stream';
import DateTimePicker from '../components/DateTimePicker';
import { isInEventsTag, localInputToIso } from '../utils/eventsTag';

// 2.0 lazy-loads the discussion composer, so it is extended by module path.
const COMPOSER = 'flarum/forum/components/DiscussionComposer';

export default function addEventDateToComposer() {
  extend(COMPOSER, 'oninit', function () {
    // Kept on the composer state so the value survives minimising the composer.
    this.composer.fields.eventAt = this.composer.fields.eventAt || Stream('');
  });

  extend(COMPOSER, 'headerItems', function (items) {
    if (!isInEventsTag(this.composer.fields.tags || [])) return;

    items.add(
      'eventAt',
      <div className="EventDateField">
        <label>
          {trans('forum.composer.event_when')}
          {app.forum.attribute('eventsCalendar.requireDate') ? <span className="EventDateField-required">{trans('forum.composer.required')}</span> : null}
        </label>
        <DateTimePicker value={this.composer.fields.eventAt} disabled={!!this.attrs.disabled} />
      </div>,
      // After the discussion title (priority 0) and the tags button (10).
      -10
    );
  });

  extend(COMPOSER, 'data', function (data) {
    const eventAt = this.composer.fields.eventAt;
    const iso = eventAt && localInputToIso(eventAt());

    if (iso && isInEventsTag(this.composer.fields.tags || [])) {
      data.eventAt = iso;
    }
  });
}
