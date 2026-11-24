import app from 'flarum/forum/app';
import trans from './utils/trans';
import { extend } from 'flarum/common/extend';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import LinkButton from 'flarum/common/components/LinkButton';
import addEventDateToComposer from './extenders/addEventDateToComposer';
import addEventBannerToDiscussion from './extenders/addEventBannerToDiscussion';
import addEventTagToNewDiscussion from './extenders/addEventTagToNewDiscussion';
import addGamePlayers from './extenders/addGamePlayers';

// Flarum 2.0: routes and model attributes are registered through extenders.
export { default as extend } from './extend';

app.initializers.add('mrcaspan-flarum2-events-calendar', () => {
  // 2.0 moved the sidebar navigation from IndexPage into IndexSidebar.
  extend(IndexSidebar.prototype, 'navItems', function (items) {
    items.add(
      'events-calendar',
      <LinkButton icon="fas fa-calendar-alt" href={app.route('events-calendar')}>
        {trans('forum.button.landing')}
      </LinkButton>,
      50
    );
  });

  addEventDateToComposer();
  addEventBannerToDiscussion();
  addEventTagToNewDiscussion();
  addGamePlayers();
});
