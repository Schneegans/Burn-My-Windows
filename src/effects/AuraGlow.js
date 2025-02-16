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

// SPDX-FileCopyrightText: Justin Garza <JGarza9788@gmail.com>
// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import * as utils from '../utils.js';

// We import the ShaderFactory only in the Shell process as it is not required in the
// preferences process. The preferences process does not create any shader instances, it
// only uses the static metadata of the effect.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// This effect was inspired by apple's new siri effect.                                 //
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
    this.shaderFactory = new ShaderFactory(Effect.getNick(), (shader) => {
      // Store uniform locations of newly created shaders.
      shader._uSpeed        = shader.get_uniform_location('uSpeed');
      shader._uRandomColor  = shader.get_uniform_location('uRandomColor');
      shader._uStartHue     = shader.get_uniform_location('uStartHue');
      shader._uSaturation   = shader.get_uniform_location('uSaturation');
      shader._uEdgeSize     = shader.get_uniform_location('uEdgeSize');
      shader._uEdgeHardness = shader.get_uniform_location('uEdgeHardness');
      shader._uBlur         = shader.get_uniform_location('uBlur');
      shader._uSeed         = shader.get_uniform_location('uSeed');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        // clang-format off
        shader.set_uniform_float(shader._uSpeed,        1, [settings.get_double('aura-glow-speed')]);
        shader.set_uniform_float(shader._uRandomColor, 1, [settings.get_boolean('aura-glow-random-color')]);
        shader.set_uniform_float(shader._uStartHue,       1, [settings.get_double('aura-glow-start-hue')]);
        shader.set_uniform_float(shader._uSaturation,   1, [settings.get_double('aura-glow-saturation')]);
        shader.set_uniform_float(shader._uEdgeSize,          1, [settings.get_double('aura-glow-edge-size')]);
        shader.set_uniform_float(shader._uEdgeHardness,      1, [settings.get_double('aura-glow-edge-hardness')]);
        shader.set_uniform_float(shader._uBlur,              1, [settings.get_double('aura-glow-blur')]);
        shader.set_uniform_float(shader._uSeed,              2, [Math.random(), Math.random()]);
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
  // (e.g. '*-animation-time'). Also, the shader file and the settings UI files should be
  // named likes this.
  static getNick() {
    return 'aura-glow';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Aura Glow');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    dialog.bindAdjustment('aura-glow-animation-time');
    dialog.bindAdjustment('aura-glow-speed');
    dialog.bindSwitch('aura-glow-random-color');
    dialog.bindAdjustment('aura-glow-start-hue');
    dialog.bindAdjustment('aura-glow-saturation');
    dialog.bindAdjustment('aura-glow-edge-size');
    dialog.bindAdjustment('aura-glow-edge-hardness');
    dialog.bindAdjustment('aura-glow-blur');

    // enable and disable the one slider
    function enableDisablePref(dialog, state) {
      dialog.getBuilder().get_object('aura-glow-start-hue-slider').set_sensitive(!state);
    }

    const switchWidget = dialog.getBuilder().get_object('aura-glow-random-color');

    // Connect to the "state-set" signal to update preferences dynamically based on
    // the switch state.
    switchWidget.connect('state-set', (widget, state) => {
      enableDisablePref(dialog, state);  // Update sensitivity when the state changes.
    });

    // Manually call the update function on startup, using the initial state of the
    // switch.
    const initialState =
      switchWidget.get_active();  // Get the current state of the switch.
    enableDisablePref(dialog, initialState);
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}