import app from 'flarum/forum/app';
import trans from '../utils/trans';
import { extend } from 'flarum/common/extend';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import Button from 'flarum/common/components/Button';
import CalendarPage from '../components/CalendarPage';
import { findEventsTag } from '../utils/eventsTag';

/**
 * On the Events calendar page the sidebar's "Start a Discussion" button becomes
 * "Post Game", and it preselects the events tag the same way flarum/tags
 * preselects the tag of the tag page you are on.
 */
export default function addEventTagToNewDiscussion() {
  extend(IndexSidebar.prototype, 'items', function (items) {
    if (!app.current.matches(CalendarPage) || !items.has('newDiscussion')) return;

    const canStartDiscussion = app.forum.attribute('canStartDiscussion') || !app.session.user;
    const label = trans('forum.button.post_game');

    items.setContent(
      'newDiscussion',
      <Button
        icon="fas fa-calendar-plus"
        className="Button Button--primary IndexPage-newDiscussion"
        itemClassName="App-primaryControl"
        aria-label={label}
        onclick={() => this.newDiscussionAction().catch(() => {})}
        disabled={!canStartDiscussion}
      >
        {label}
      </Button>
    );
  });

  extend(IndexSidebar.prototype, 'newDiscussionAction', function (promise) {
    if (!app.current.matches(CalendarPage)) return;

    const tag = findEventsTag();
    if (!tag) return;

    const parent = tag.parent && tag.parent();
    const tags = parent ? [parent, tag] : [tag];

    // A guest is asked to log in instead, which rejects the promise.
    promise.then(
      (composer) => (composer.fields.tags = tags),
      () => {}
    );
  });
}
