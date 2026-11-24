import app from 'flarum/forum/app';
import trans from '../utils/trans';
import Component from 'flarum/common/Component';
import extractText from 'flarum/common/utils/extractText';
import dynamicallyLoadLib from '../utils/dynamicallyLoadLib';
import { toLocalInput } from '../utils/eventsTag';

/**
 * Date + time picker with an OK button (flatpickr + confirmDate plugin).
 *
 * Attrs:
 * - `value`: a Stream holding a local "YYYY-MM-DDTHH:mm" string ('' = no date).
 * - `disabled`: optional boolean.
 * - `boxed`: optional boolean; full-width boxed field with a calendar icon (used in dialogs).
 *
 * Uses a single input: flatpickr formats it for display, and the picked Date is
 * converted to the stored format here (no altInput, so there is never a second box).
 * On phones flatpickr hands over to the phone's own picker, which has a Done button.
 */
export default class DateTimePicker extends Component {
  view() {
    const hasValue = !!this.attrs.value();
    const clearLabel = extractText(trans('forum.picker.clear'));

    return (
      <div className={'DateTimePicker' + (this.attrs.boxed ? ' DateTimePicker--boxed' : '')}>
        {this.attrs.boxed ? <i className="fas fa-calendar-alt DateTimePicker-icon" aria-hidden="true" /> : null}
        <input
          className="FormControl DateTimePicker-input"
          type="text"
          readonly
          placeholder={extractText(trans('forum.picker.placeholder'))}
          disabled={!!this.attrs.disabled}
        />
        {hasValue && !this.attrs.disabled ? (
          <button type="button" className="DateTimePicker-clear" aria-label={clearLabel} title={clearLabel} onclick={() => this.clear()}>
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    this.setup();
  }

  /** Follow changes made to the value from outside (e.g. quick-pick buttons). */
  onupdate(vnode) {
    super.onupdate && super.onupdate(vnode);
    if (!this.picker) return;

    const value = this.attrs.value();
    const current = this.picker.selectedDates[0] ? toLocalInput(this.picker.selectedDates[0]) : '';

    if (value !== current) {
      if (value) this.picker.setDate(new Date(value), false);
      else this.picker.clear(false);
    }
  }

  onremove(vnode) {
    super.onremove(vnode);
    this.removed = true;

    if (this.picker) {
      this.picker.destroy();
      this.picker = null;
    }
  }

  async setup() {
    if (this.settingUp || this.picker) return;
    this.settingUp = true;

    await dynamicallyLoadLib(['flatpickr', 'flatpickrConfirm']);

    const input = this.element && this.element.querySelector('.DateTimePicker-input');
    if (this.removed || !input || !input.isConnected || this.picker) return;

    const value = this.attrs.value;
    const initial = value() ? new Date(value()) : null;

    this.picker = window.flatpickr(input, {
      enableTime: true,
      dateFormat: 'D, M j, Y  h:i K',
      defaultDate: initial && !isNaN(initial.getTime()) ? initial : null,
      minuteIncrement: 5,
      plugins: [
        new window.confirmDatePlugin({
          confirmText: extractText(trans('forum.picker.ok')) + ' ',
          confirmIcon: '<i class="fas fa-check"></i>',
          showAlways: true,
        }),
      ],
      onChange: (dates) => {
        value(dates && dates[0] ? toLocalInput(dates[0]) : '');
        m.redraw();
      },
      onClose: () => this.returnFocusToComposer(),
    });
  }

  /**
   * The popup lives outside the composer, so choosing a date takes focus away and
   * Flarum fades the composer. Put the cursor in the post body unless the member
   * already clicked somewhere else inside the composer (e.g. the title).
   */
  returnFocusToComposer() {
    const composerEl = this.element && this.element.closest('.Composer');
    if (!composerEl) return;

    setTimeout(() => {
      if (composerEl.contains(document.activeElement)) return;

      try {
        if (app.composer && app.composer.editor) app.composer.editor.focus();
      } catch (e) {
        // Not critical: the member can click back into the composer.
      }
    }, 0);
  }

  clear() {
    if (this.picker) this.picker.clear();
    this.attrs.value('');
  }
}
