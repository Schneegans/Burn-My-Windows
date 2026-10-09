//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Ido Greenfeld <15867904+idogrf@users.noreply.github.com>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

//////////////////////////////////////////////////////////////////////////////////////////
// This is a Gtk.Scale whose value can be typed in. It looks exactly like a normal      //
// Gtk.Scale, but when the value next to the slider is clicked, a text field is shown   //
// in its place. Pressing Enter or clicking somewhere else applies the typed value,     //
// pressing Escape discards it. In the ui files, it is used just like a Gtk.Scale.      //
//////////////////////////////////////////////////////////////////////////////////////////

class Slider extends Gtk.Scale {
  // ------------------------------------------------------------------------- constructor

  constructor(params = {}) {
    super(params);

    // This is the text field which is shown on top of the value while it is edited. It
    // is hidden the rest of the time. It is a normal Gtk.Entry, so that it is obvious
    // that the value is being edited. It uses tabular digits, like the value itself. It
    // is given the size of the value later on, so it should not ask for more space than
    // that by itself. This is why the number of characters is so small. The text is
    // centered, as the text field is as wide as the longest possible value.
    this._entry = new Gtk.Entry({visible: false, width_chars: 1, xalign: 0.5});
    this._entry.add_css_class('numeric');
    this._entry.set_parent(this);

    // Pressing Enter applies the typed value.
    this._entry.connect('activate', () => this._stopEditing(true));

    // Moving the focus somewhere else applies the typed value as well.
    const focus = new Gtk.EventControllerFocus();
    focus.connect('leave', () => this._stopEditing(true));
    this._entry.add_controller(focus);

    // Pressing Escape discards the typed value. We return true in this case, so that the
    // key press is not handled any further. Else, it would also close the preferences
    // dialog. The key presses go to the text inside the Gtk.Entry, so we have to look at
    // them on their way there.
    const keys =
      new Gtk.EventControllerKey({propagation_phase: Gtk.PropagationPhase.CAPTURE});
    keys.connect('key-pressed', (controller, keyval) => {
      if (keyval === Gdk.KEY_Escape) {
        this._stopEditing(false);
        return true;
      }
      return false;
    });
    this._entry.add_controller(keys);

    // Clicking on the value starts the editing. This gesture runs before the ones of the
    // Gtk.Scale, so that clicking on the value does not move the slider.
    const click = new Gtk.GestureClick({propagation_phase: Gtk.PropagationPhase.CAPTURE});
    click.connect('pressed', (gesture, n, x, y) => {
      // Only clicks on the value itself start the editing. Clicks on the slider are left
      // to the Gtk.Scale.
      const value = this._getValueAt(x, y);
      if (value && !this._entry.visible) {
        // Claiming the click prevents the Gtk.Scale from handling it as well.
        gesture.set_state(Gtk.EventSequenceState.CLAIMED);
        this._startEditing(value);
      }
    });
    this.add_controller(click);

    // As a hint that the value can be edited, the pointer becomes a text cursor while it
    // is above the value. Everywhere else, the normal pointer is shown.
    const motion       = new Gtk.EventControllerMotion();
    const updateCursor = (x, y) => {
      this.set_cursor_from_name(this._getValueAt(x, y) ? 'text' : null);
    };
    motion.connect('enter', (controller, x, y) => updateCursor(x, y));
    motion.connect('motion', (controller, x, y) => updateCursor(x, y));
    motion.connect('leave', () => this.set_cursor_from_name(null));
    this.add_controller(motion);
  }

  // ----------------------------------------------------------------- GTK virtual methods

  // The Gtk.Scale does not know about the text field, so we have to place it on top of
  // the value ourselves. It may need to be a bit larger than the value.
  vfunc_size_allocate(width, height, baseline) {
    super.vfunc_size_allocate(width, height, baseline);

    const value = this._getValueLabel();
    if (this._entry.visible && value) {
      // The Gtk.Scale has just placed the value, so its bounds are up to date.
      const [, bounds] = value.compute_bounds(this);

      // GTK requires widgets to be measured before they are given a size. The text field
      // must not become smaller than its minimum size, else GTK would complain.
      const [minWidth]  = this._entry.measure(Gtk.Orientation.HORIZONTAL, -1);
      const [minHeight] = this._entry.measure(Gtk.Orientation.VERTICAL, -1);

      // The Gtk.Entry draws a frame with some padding around its text. We want its text
      // to stay exactly where the value was, so the frame has to stick out by the width
      // of the padding on both sides. The padding is the difference between the minimum
      // widths of the Gtk.Entry and of the text inside of it.
      const [textMinWidth] =
        this._entry.get_first_child().measure(Gtk.Orientation.HORIZONTAL, -1);
      const padding = Math.round((minWidth - textMinWidth) / 2);

      // If the text field is taller than the value, it is centered vertically on it.
      const allocation  = new Gdk.Rectangle();
      allocation.width  = Math.max(minWidth, bounds.get_width() + 2 * padding);
      allocation.height = Math.max(minHeight, bounds.get_height());
      allocation.x      = bounds.get_x() - padding;
      allocation.y      = bounds.get_y() + (bounds.get_height() - allocation.height) / 2;
      this._entry.size_allocate(allocation, -1);
    }
  }

  // The Gtk.Scale only draws its own parts, so we draw the text field on top of them.
  vfunc_snapshot(snapshot) {
    super.vfunc_snapshot(snapshot);

    if (this._entry.visible) {
      this.snapshot_child(this._entry, snapshot);
    }
  }

  // The text field has been added by us, so we also have to remove it.
  vfunc_dispose() {
    if (this._entry) {
      this._entry.unparent();
      this._entry = null;
    }
    super.vfunc_dispose();
  }

  // ----------------------------------------------------------------------- private stuff

  // Returns the value label if the given point is on top of it, else null. The point has
  // to be given in the coordinate system of this widget, so it has to be translated to
  // the one of the value first.
  _getValueAt(x, y) {
    const value = this._getValueLabel();
    if (!value) {
      return null;
    }

    const [, valueX, valueY] = this.translate_coordinates(value, x, y);
    return value.contains(valueX, valueY) ? value : null;
  }

  // Returns the label which the Gtk.Scale uses to draw its value. It is documented to
  // have the CSS name "value". It only exists if the value is drawn at all.
  _getValueLabel() {
    // The value is one of the direct children of the Gtk.Scale, next to the trough.
    for (let child = this.get_first_child(); child; child = child.get_next_sibling()) {
      if (child.get_css_name() === 'value' && child instanceof Gtk.Label) {
        return child;
      }
    }
    return null;
  }

  // Shows the text field on top of the value. It starts with the text of the value, so
  // it uses the same number format, and the text is selected so that it can be
  // replaced right away.
  _startEditing(value) {
    this._entry.text    = value.get_label();
    this._entry.visible = true;
    this._entry.grab_focus();
    this._entry.select_region(0, -1);

    // The text field has to be placed on top of the value before it can be drawn.
    this.queue_allocate();
  }

  // Hides the text field again. If commit is true, the typed value is applied first.
  // Hiding the text field moves the focus away from it, which would call this method
  // again. This is prevented by checking whether the text field is still visible.
  _stopEditing(commit) {
    if (!this._entry || !this._entry.visible) {
      return;
    }

    const text          = this._entry.text;
    this._entry.visible = false;

    // Give the focus back to the slider, so that it can still be used with the keyboard.
    this.grab_focus();

    if (commit) {
      this._applyText(text);
    }
  }

  // Tries to interpret the given text as a number and sets it as the new value. Both "."
  // and "," are accepted as decimal separator, independent of the locale. Anything else
  // is ignored, so the previous value is kept.
  _applyText(text) {
    const trimmed = text.trim().replace(',', '.');

    // This accepts an optional sign followed by digits with an optional decimal part.
    // Anything else, like letters or several numbers, is rejected.
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(trimmed)) {
      return;
    }

    // Typed values may be out of range or have too many decimal places. The slider
    // rounds its values to the given number of digits, so we do the same here. This is
    // especially important for integer settings, as these would silently truncate values.
    const adjustment = this.adjustment;
    const clamped =
      Math.min(Math.max(Number(trimmed), adjustment.lower), adjustment.upper);
    this.set_value(Number(clamped.toFixed(this.digits)));
  }
}

// The ui files refer to the widget by this name.
export default GObject.registerClass({GTypeName: 'BurnMyWindowsSlider'}, Slider);
