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

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

//////////////////////////////////////////////////////////////////////////////////////////
// This widget is used for all numeric settings in the preferences dialog. It combines  //
// a Gtk.Scale with a Gtk.SpinButton, so that values can be dragged roughly with the    //
// slider or typed in precisely. Both share the same Gtk.Adjustment, so they always     //
// show the same value. In the ui files, it is used like a Gtk.Scale: The adjustment is //
// assigned to the "adjustment" property and the "digits" property defines how many     //
// decimal places are shown and to which precision the slider rounds its values.        //
//////////////////////////////////////////////////////////////////////////////////////////

const _annotations = {
  // The ui files refer to the widget by this name.
  GTypeName: 'BurnMyWindowsSlider',
  Properties: {
    'adjustment': GObject.ParamSpec.object(
      'adjustment', 'Adjustment', 'The adjustment shared by the slider and spin button.',
      GObject.ParamFlags.READWRITE, Gtk.Adjustment),
    'digits': GObject.ParamSpec.int('digits', 'Digits',
                                    'The number of decimal places of the value.',
                                    GObject.ParamFlags.READWRITE, 0, 20, 0),
  },
};

class Slider extends Gtk.Box {
  // ------------------------------------------------------------------------- constructor

  constructor(params = {}) {
    super(params);

    this.spacing = 6;

    // The spin button is placed on the left, where the Gtk.Scale used to draw its value.
    this._spinButton = new Gtk.SpinButton({valign: Gtk.Align.CENTER});
    this.append(this._spinButton);

    // The slider rounds its values to the given number of digits, but typed values are
    // stored as they are. As the spin button displays rounded values anyway, and integer
    // settings would silently truncate them, we round typed values the same way. We do
    // not use the "numeric" property of the spin button for this: It would reset values
    // with too many decimal places to zero instead of rounding them.
    this._spinButton.connect('value-changed', () => {
      const rounded = Number(this._spinButton.value.toFixed(this.digits));
      if (rounded !== this._spinButton.value) {
        this._spinButton.value = rounded;
      }
    });

    // The slider takes all the remaining space. It does not draw its value anymore, as
    // this is now shown by the spin button.
    this._scale = new Gtk.Scale({hexpand: true, draw_value: false});
    this.append(this._scale);

    // Forward our properties to the children. The ui files may set them before or after
    // construction, SYNC_CREATE makes sure that both cases are covered.
    for (const child of [this._spinButton, this._scale]) {
      this.bind_property('adjustment', child, 'adjustment',
                         GObject.BindingFlags.SYNC_CREATE);
      this.bind_property('digits', child, 'digits', GObject.BindingFlags.SYNC_CREATE);
    }
  }
}

export default GObject.registerClass(_annotations, Slider);
