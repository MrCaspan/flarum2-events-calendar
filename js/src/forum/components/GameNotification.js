import app from 'flarum/forum/app';
import trans from '../utils/trans';
import Notification from 'flarum/forum/components/Notification';

const ICONS = {
  invited: 'fas fa-envelope-open-text',
  offered: 'fas fa-chair',
  request: 'fas fa-hand-paper',
  accepted: 'fas fa-check',
  declined: 'fas fa-times',
  left: 'fas fa-sign-out-alt',
  left_waitlist: 'fas fa-sign-out-alt',
  approved_seat: 'fas fa-check',
  approved_waitlist: 'fas fa-list-ol',
  expired: 'far fa-clock',
  expired_host: 'far fa-clock',
};

export default class GameNotification extends Notification {
  kind() {
    const data = this.attrs.notification.content() || {};
    return data.kind || 'invited';
  }

  icon() {
    return ICONS[this.kind()] || 'fas fa-users';
  }

  href() {
    const discussion = this.attrs.notification.subject();
    return discussion ? app.route.discussion(discussion) : app.route('index');
  }

  content() {
    const notification = this.attrs.notification;
    const data = notification.content() || {};

    return trans('forum.notifications.' + this.kind(), {
      user: notification.fromUser(),
      time: data.expires ? dayjs(data.expires).format('ddd h:mm A') : '',
    });
  }

  excerpt() {
    const discussion = this.attrs.notification.subject();
    return discussion && discussion.title ? discussion.title() : null;
  }
}
