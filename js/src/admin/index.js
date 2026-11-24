import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';
import Switch from 'flarum/common/components/Switch';

const PREFIX = 'mrcaspan-flarum2-events-calendar.admin.settings.';
const SETTING = 'mrcaspan-events-calendar.';
const t = (key, params) => app.translator.trans(PREFIX + key, params);

// Must match Words::DEFAULTS in PHP.
const WORDS = [
  ['event', 'Event'],
  ['events', 'Events'],
  ['attendee', 'Attendee'],
  ['attendees', 'Attendees'],
  ['spot', 'Spot'],
  ['spots', 'Spots'],
];

let tagsRequested = false;

function tagOptions() {
  if (!tagsRequested) {
    tagsRequested = true;
    app.store.find('tags').then(() => m.redraw());
  }

  const options = { '': '— none —' };

  app.store
    .all('tags')
    .filter((tag) => tag && tag.slug && tag.slug())
    .sort((a, b) => (a.name() || '').localeCompare(b.name() || ''))
    .forEach((tag) => {
      options[tag.slug()] = tag.name();
    });

  return options;
}

// Flarum 2.0: admin settings are registered through the Admin extender.
export const extend = [
  new Extend.Admin()
    .customSetting(function () {
      // Called with the extension's settings page as `this`.
      const setting = this.setting(SETTING + 'events_tag');
      const value = setting() || '';
      const options = tagOptions();

      // Show the saved tag even before the tag list has loaded.
      if (value && !(value in options)) options[value] = value;

      return (
        <div className="Form-group EventsCalendar-setting">
          <label>{t('events_tag')}</label>
          <p className="helpText">{t('events_tag_help')}</p>
          <p className="helpText">{t('who_help', { a: <a href={app.route('permissions')} /> })}</p>
          <span className="Select">
            <select className="Select-input FormControl" onchange={(e) => setting(e.target.value)}>
              {Object.keys(options).map((slug) => (
                <option value={slug} selected={slug === value}>
                  {options[slug]}
                </option>
              ))}
            </select>
            <i aria-hidden="true" className="icon fas fa-sort Select-caret" />
          </span>
        </div>
      );
    })
    .customSetting(function () {
      const setting = this.setting(SETTING + 'require_date');
      const on = ['1', 1, true, 'true'].includes(setting());

      return (
        <div className="Form-group EventsCalendar-setting">
          <Switch state={on} onchange={(value) => setting(value ? '1' : '0')}>
            {t('require_date')}
          </Switch>
          <p className="helpText">{t('require_date_help')}</p>
        </div>
      );
    })
    .customSetting(function () {
      return (
        <div className="Form-group EventsCalendar-setting EventsCalendar-words">
          <label>{t('words_heading')}</label>
          <p className="helpText">{t('words_help')}</p>
          <div className="EventsCalendar-wordsGrid">
            {WORDS.map(([name, fallback]) => {
              const setting = this.setting(SETTING + 'word_' + name);

              return (
                <label className="EventsCalendar-word">
                  <span>{t('word_' + name)}</span>
                  <input className="FormControl" type="text" placeholder={fallback} bidi={setting} />
                </label>
              );
            })}
          </div>
        </div>
      );
    }),
];

app.initializers.add('mrcaspan-flarum2-events-calendar', () => {});
