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
// This effect hides the actor by violently sucking it into the void of magic.          //
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
      shader._uSeed       = shader.get_uniform_location('uSeed');
      shader._uShake      = shader.get_uniform_location('uShake');
      shader._uTwirl      = shader.get_uniform_location('uTwirl');
      shader._uSuction    = shader.get_uniform_location('uSuction');
      shader._uRandomness = shader.get_uniform_location('uRandomness');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings, forOpening, testMode) => {
        // clang-format off
        shader.set_uniform_float(shader._uSeed,       2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
        shader.set_uniform_float(shader._uShake,      1, [settings.get_double('apparition-shake-intensity')]);
        shader.set_uniform_float(shader._uTwirl,      1, [settings.get_double('apparition-twirl-intensity')]);
        shader.set_uniform_float(shader._uSuction,    1, [settings.get_double('apparition-suction-intensity')]);
        shader.set_uniform_float(shader._uRandomness, 1, [settings.get_double('apparition-randomness')]);
        // clang-format on
      });
    });
  }

  // ---------------------------------------------------------------------------- metadata

  // The effect is not available on GNOME Shell 3.36 as it requires scaling of the window
  // actor.
  static getMinShellVersion() {
    return [3, 38];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-enable-effect'), and its animation time
  // (e.g. '*-animation-time').
  static getNick() {
    return 'apparition';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Apparition');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    dialog.bindAdjustment('apparition-randomness');
    dialog.bindAdjustment('apparition-animation-time');
    dialog.bindAdjustment('apparition-twirl-intensity');
    dialog.bindAdjustment('apparition-shake-intensity');
    dialog.bindAdjustment('apparition-suction-intensity');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 2.0, y: 2.0};
  }
}
