import app from 'flarum/forum/app';
import trans from '../utils/trans';
import Page from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import WelcomeHero from 'flarum/forum/components/WelcomeHero';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import extractText from 'flarum/common/utils/extractText';
import dynamicallyLoadLib from '../utils/dynamicallyLoadLib';

export default class CalendarPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);

    const title = extractText(trans('forum.button.landing'));

    app.history.push('events-calendar', title);
    this.bodyClass = 'App--calendar';
    app.setTitle(title);
    app.setTitleCount(0);
  }

  view() {
    // 2.0 pages are built with PageStructure (hero + sidebar + content).
    return (
      <PageStructure className="IndexPage CalendarPage" hero={() => <WelcomeHero />} sidebar={() => <IndexSidebar />}>
        <div
          className="CalendarPage-calendar"
          oncreate={(vnode) => this.renderCalendar(vnode.dom)}
          onremove={() => this.calendar && this.calendar.destroy()}
        />
      </PageStructure>
    );
  }

  async renderCalendar(calendarEl) {
    await dynamicallyLoadLib('fullcalendarCore');
    await dynamicallyLoadLib(['fullcalendarLocales', 'fullcalendarDayGrid', 'fullcalendarInteraction', 'fullcalendarList']);

    if (!calendarEl || !calendarEl.isConnected) return;

    this.calendar = new FullCalendar.Calendar(calendarEl, {
      locale: app.translator.getLocale(),
      headerToolbar: { center: 'dayGridMonth,listYearFromToday' },
      initialView: 'dayGridMonth',
      views: {
        listYearFromToday: {
          type: 'list',
          visibleRange: (currentDate) => {
            const start = new Date(currentDate.valueOf());
            const end = new Date(currentDate.valueOf());
            end.setFullYear(end.getFullYear() + 1);
            return { start, end };
          },
          listDaySideFormat: { weekday: 'long' },
        },
      },
      events: this.fetchEvents.bind(this),
    });

    this.calendar.render();
  }

  async fetchEvents(info, successCb, failureCb) {
    try {
      const rows = await app.request({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + '/events-calendar',
        params: { start: info.startStr, end: info.endStr },
      });

      successCb(
        (rows || []).map((row) => ({
          title: row.title,
          start: row.event_at,
          url: row.url,
        }))
      );
    } catch (err) {
      failureCb(err);
    }
  }
}
