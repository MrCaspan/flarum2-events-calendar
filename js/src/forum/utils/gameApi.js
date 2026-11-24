import app from 'flarum/forum/app';

function base(discussionId) {
  return `${app.forum.attribute('apiUrl')}/events-calendar/${discussionId}`;
}

export function loadGame(discussionId) {
  return app.request({ method: 'GET', url: base(discussionId) });
}

/** POST an action ({ action, ...params }); resolves with the updated list. */
export function gameAction(discussionId, body) {
  return app.request({ method: 'POST', url: base(discussionId), body });
}

export function searchMembers(discussionId, q) {
  return app.request({ method: 'GET', url: `${base(discussionId)}/users`, params: { q } });
}
