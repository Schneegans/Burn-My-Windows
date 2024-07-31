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

// We import some modules only in the Shell process as they are not available in the
// preferences process. They are used only in the creator function of the ShaderFactory
// which is only called within GNOME Shell's process.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');
const Clutter       = await utils.importInShellOnly('gi://Clutter');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// This effect overlays a glowing hexagonal grid over the window. The grid cells then   //
// gradually shrink until the window is fully dissolved.                                //
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
      shader._uAdditiveBlending = shader.get_uniform_location('uAdditiveBlending');
      shader._uSeed             = shader.get_uniform_location('uSeed');
      shader._uScale            = shader.get_uniform_location('uScale');
      shader._uLineWidth        = shader.get_uniform_location('uLineWidth');
      shader._uGlowColor        = shader.get_uniform_location('uGlowColor');
      shader._uLineColor        = shader.get_uniform_location('uLineColor');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings, forOpening, testMode) => {
        // clang-format off
        shader.set_uniform_float(shader._uAdditiveBlending, 1, [settings.get_boolean('hexagon-additive-blending')]);
        shader.set_uniform_float(shader._uSeed,             2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
        shader.set_uniform_float(shader._uScale,            1, [settings.get_double('hexagon-scale')]);
        shader.set_uniform_float(shader._uLineWidth,        1, [settings.get_double('hexagon-line-width')]);
        shader.set_uniform_float(shader._uGlowColor,        4, utils.parseColor(settings.get_string('hexagon-glow-color')));
        shader.set_uniform_float(shader._uLineColor,        4, utils.parseColor(settings.get_string('hexagon-line-color')));
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
    return 'hexagon';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Hexagon');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    dialog.bindAdjustment('hexagon-animation-time');
    dialog.bindAdjustment('hexagon-scale');
    dialog.bindAdjustment('hexagon-line-width');
    dialog.bindColorButton('hexagon-line-color');
    dialog.bindColorButton('hexagon-glow-color');
    dialog.bindSwitch('hexagon-additive-blending');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}
