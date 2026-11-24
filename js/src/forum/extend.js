import Extend from 'flarum/common/extenders';
import Model from 'flarum/common/Model';
import Discussion from 'flarum/common/models/Discussion';
import CalendarPage from './components/CalendarPage';

export default [
  new Extend.Routes() //
    .add('events-calendar', '/events', CalendarPage),

  new Extend.Model(Discussion) //
    .attribute('eventAt', Model.transformDate),
];
