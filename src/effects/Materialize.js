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

// SPDX-FileCopyrightText: eboye <eboyee@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import * as utils from '../utils.js';

// We import the ShaderFactory only in the Shell process as it is not required in the
// preferences process. The preferences process does not create any shader instances, it
// only uses the static metadata of the effect.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

const Gio = await utils.importInShellOnly('gi://Gio');

const _ = await utils.importGettext();

// These are the accent colors of libadwaita. GNOME only stores the name of the selected
// accent color, so we have to map it to the actual color ourselves.
const ACCENT_COLORS = {
  blue: 'rgb(53, 132, 228)',
  teal: 'rgb(33, 144, 164)',
  green: 'rgb(58, 148, 74)',
  yellow: 'rgb(200, 136, 0)',
  orange: 'rgb(237, 91, 0)',
  red: 'rgb(230, 45, 66)',
  pink: 'rgb(213, 97, 153)',
  purple: 'rgb(145, 65, 172)',
  slate: 'rgb(111, 131, 150)',
};

// The accent color is fully opaque. This is how strongly it tints the panel.
const ACCENT_TINT = 0.85;

// Returns the system accent color as [r, g, b, a], or null if the system does not
// support accent colors (GNOME Shell < 47).
function getAccentColor(interfaceSettings) {
  if (!interfaceSettings) {
    return null;
  }

  const color = ACCENT_COLORS[interfaceSettings.get_string('accent-color')];
  if (!color) {
    return null;
  }

  const [r, g, b] = utils.parseColor(color);
  return [r, g, b, ACCENT_TINT];
}

//////////////////////////////////////////////////////////////////////////////////////////
// This effect is inspired by the computer interfaces seen in The Matrix Resurrections. //
// Windows pop up as a flat, tinted panel which grows to full size in a few stuttering  //
// steps before the actual window content materializes.                                 //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
export default class Effect {

  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.
  constructor() {
    // The accent-color key was added in GNOME 47. On older versions, the custom color is
    // used instead.
    const schema =
      Gio.SettingsSchemaSource.get_default().lookup('org.gnome.desktop.interface', true);
    if (schema?.has_key('accent-color')) {
      this._interfaceSettings = new Gio.Settings({settings_schema: schema});
    }

    this.shaderFactory = new ShaderFactory(Effect.getNick(), (shader) => {
      // Store uniform locations of newly created shaders.
      shader._uColor      = shader.get_uniform_location('uColor');
      shader._uStartScale = shader.get_uniform_location('uStartScale');
      shader._uSteps      = shader.get_uniform_location('uSteps');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        let color = null;
        if (settings.get_boolean('materialize-use-accent-color')) {
          color = getAccentColor(this._interfaceSettings);
        }
        if (!color) {
          color = utils.parseColor(settings.get_string('materialize-color'));
        }

        // clang-format off
        shader.set_uniform_float(shader._uColor,      4, color);
        shader.set_uniform_float(shader._uStartScale, 1, [settings.get_double('materialize-start-scale')]);
        shader.set_uniform_float(shader._uSteps,      1, [settings.get_int('materialize-steps')]);
        // clang-format on
      });
    });
  }

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-enable-effect'), and its animation time
  // (e.g. '*-animation-time').
  static getNick() {
    return 'materialize';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Materialize');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    dialog.bindAdjustment('materialize-animation-time');
    dialog.bindAdjustment('materialize-start-scale');
    dialog.bindAdjustment('materialize-steps');
    dialog.bindSwitch('materialize-use-accent-color');
    dialog.bindColorButton('materialize-color');

    // The custom color is only used if the accent color is disabled.
    const colorRow     = dialog.getBuilder().get_object('materialize-color-row');
    const accentSwitch = dialog.getBuilder().get_object('materialize-use-accent-color');
    colorRow.set_sensitive(!accentSwitch.get_active());
    accentSwitch.connect('notify::active', () => {
      colorRow.set_sensitive(!accentSwitch.get_active());
    });
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}
