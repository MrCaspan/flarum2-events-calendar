/**
 * Posts only redraw when their SubtreeRetainer checks change, so a plain
 * m.redraw() never reaches the players list inside the first post. The list
 * bumps this counter whenever it changes and CommentPost checks it.
 */
let version = 0;

export function gameVersion() {
  return version;
}

export function bumpGameVersion() {
  version++;
}
