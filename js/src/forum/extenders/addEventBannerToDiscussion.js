import { extend, override } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import EventBanner from '../components/EventBanner';
import { isInEventsTag, canEditEvent } from '../utils/eventsTag';

function showBanner(discussion) {
  if (!discussion) return false;

  const eventAt = discussion.eventAt && discussion.eventAt();
  const inEventsTag = isInEventsTag((discussion.tags && discussion.tags()) || []);

  // Everyone sees a date that is set. Without a date, only people who can edit
  // it see the "Add event date" prompt, and only in the events tag.
  return !!eventAt || (inEventsTag && canEditEvent(discussion));
}

export default function addEventBannerToDiscussion() {
  // The "When" banner sits at the top of the first post (not in the title hero).
  // Posts are subtree-retained, so redraw post #1 when the date changes.
  extend(CommentPost.prototype, 'oninit', function () {
    const post = this.attrs.post;
    if (!post || post.number() !== 1) return;

    this.subtree.check(() => {
      const d = post.discussion();
      const at = d && d.eventAt && d.eventAt();
      return at ? at.getTime() : 0;
    });
  });

  // Post#header() renders above the avatar + content grid (core returns null),
  // so the banner spans the top of the first post and the avatar stays beside
  // the author line.
  override(CommentPost.prototype, 'header', function (original) {
    const header = original();
    const post = this.attrs.post;
    if (!post || post.number() !== 1) return header;

    const discussion = post.discussion();
    if (!showBanner(discussion)) return header;

    return [header, <EventBanner discussion={discussion} />];
  });
}
