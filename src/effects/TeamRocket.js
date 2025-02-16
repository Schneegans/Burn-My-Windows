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

// SPDX-FileCopyrightText: Justin Garza JGarza9788@gmail.com
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import * as utils from '../utils.js';

// We import the ShaderFactory only in the Shell process as it is not required in the
// preferences process. The preferences process does not create any shader instances, it
// only uses the static metadata of the effect.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// This effect was inspired by Team Rocket Blasting Off again!                          //
// https://c.tenor.com/0ag0MVXUaQEAAAAd/tenor.gif                                       //
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
      shader._uAnimationSplit = shader.get_uniform_location('uAnimationSplit');
      shader._uHorizontalSparklePosition =
        shader.get_uniform_location('uHorizontalSparklePosition');
      shader._uVerticalSparklePosition =
        shader.get_uniform_location('uVerticalSparklePosition');
      shader._uWindowRotation = shader.get_uniform_location('uWindowRotation');
      shader._uSparkleRot     = shader.get_uniform_location('uSparkleRot');
      shader._uSparkleSize    = shader.get_uniform_location('uSparkleSize');

      shader._uSeed = shader.get_uniform_location('uSeed');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        // clang-format off
        shader.set_uniform_float(shader._uAnimationSplit,            1, [settings.get_double('team-rocket-animation-split')]);
        shader.set_uniform_float(shader._uHorizontalSparklePosition, 1, [settings.get_double('team-rocket-horizontal-sparkle-position')]);
        shader.set_uniform_float(shader._uVerticalSparklePosition,   1, [settings.get_double('team-rocket-vertical-sparkle-position')]);
        shader.set_uniform_float(shader._uWindowRotation,            1, [settings.get_boolean('team-rocket-window-rotation')]);
        shader.set_uniform_float(shader._uSparkleRot,  1, [settings.get_double('team-rocket-sparkle-rot')]);
        shader.set_uniform_float(shader._uSparkleSize, 1, [settings.get_double('team-rocket-sparkle-size')]);
        // clang-format on

        // This will be used with a hash function to get a random number.
        shader.set_uniform_float(shader._uSeed, 2, [Math.random(), Math.random()]);
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
    return 'team-rocket';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Team Rocket');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    dialog.bindAdjustment('team-rocket-animation-time');
    dialog.bindAdjustment('team-rocket-animation-split');
    dialog.bindAdjustment('team-rocket-horizontal-sparkle-position');
    dialog.bindAdjustment('team-rocket-vertical-sparkle-position');
    dialog.bindSwitch('team-rocket-window-rotation');
    dialog.bindAdjustment('team-rocket-sparkle-rot');
    dialog.bindAdjustment('team-rocket-sparkle-size');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}
