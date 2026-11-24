import app from 'flarum/forum/app';
import trans from '../utils/trans';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import GamePlayers from '../components/GamePlayers';
import GameNotification from '../components/GameNotification';
import ScheduleNextButton from '../components/ScheduleNextButton';
import { isInEventsTag, canEditEvent } from '../utils/eventsTag';
import { gameVersion } from '../utils/gameVersion';

export default function addGamePlayers() {
  // Let the players list redraw the (otherwise retained) first post.
  extend(CommentPost.prototype, 'oninit', function () {
    if (this.attrs.post && this.attrs.post.number() === 1) this.subtree.check(gameVersion);
  });

  // The player list sits under the game description in the first post.
  extend(CommentPost.prototype, 'content', function (items) {
    const post = this.attrs.post;
    if (!post || post.number() !== 1 || this.isEditing?.()) return;

    const discussion = post.discussion();
    if (!discussion || !isInEventsTag((discussion.tags && discussion.tags()) || [])) return;

    // No `key`: CommentPost's other children are unkeyed, and Mithril throws
    // (blanking the whole post stream) when keyed and unkeyed siblings mix.
    items.push(<GamePlayers discussion={discussion} />);
  });

  // Host only: "Schedule next game" in the discussion sidebar, under Reply and
  // Following and above the post scrubber (-100).
  extend(DiscussionPage.prototype, 'sidebarItems', function (items) {
    const discussion = this.discussion;
    if (!discussion || !isInEventsTag((discussion.tags && discussion.tags()) || []) || !canEditEvent(discussion)) return;

    items.add('scheduleNextGame', <ScheduleNextButton discussion={discussion} />, -90);
  });

  app.notificationComponents.eventsCalendarAttendees = GameNotification;

  // NotificationGrid is lazy-loaded in 2.0, so extend it by module path.
  extend('flarum/forum/components/NotificationGrid', 'notificationTypes', function (items) {
    items.add('eventsCalendarAttendees', {
      name: 'eventsCalendarAttendees',
      icon: 'fas fa-users',
      label: trans('forum.notifications.settings_label'),
    });
  });
}
