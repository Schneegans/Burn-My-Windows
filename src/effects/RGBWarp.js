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

// SPDX-FileCopyrightText: Your Name <your@email.com>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import * as utils from '../utils.js';

// We import the ShaderFactory only in the Shell process as it is not required in the
// preferences process. The preferences process does not create any shader instances, it
// only uses the static metadata of the effect.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// This effect ...                                                                      //
// <- Please add a description of your effect here ->                                   //
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
      shader._uWavesize   = shader.get_uniform_location('uWavesize');
      shader._uBrightness = shader.get_uniform_location('uBrightness');
      shader._uStretchR   = shader.get_uniform_location('uStretchR');
      shader._uStretchG   = shader.get_uniform_location('uStretchG');
      shader._uStretchB   = shader.get_uniform_location('uStretchB');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        shader.set_uniform_float(shader._uWavesize, 1, [
          settings.get_double('rgbwarp-wavesize'),
        ]);

        shader.set_uniform_float(shader._uBrightness, 1, [
          settings.get_double('rgbwarp-brightness'),
        ]);

        shader.set_uniform_float(shader._uStretchR, 1, [
          settings.get_double('rgbwarp-offset-r'),
        ]);

        shader.set_uniform_float(shader._uStretchG, 1, [
          settings.get_double('rgbwarp-offset-g'),
        ]);

        shader.set_uniform_float(shader._uStretchB, 1, [
          settings.get_double('rgbwarp-offset-b'),
        ]);
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
    return 'rgbwarp';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('RGB Warp Effect');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    // Empty for now... Code is added here later in the tutorial!

    dialog.bindAdjustment('rgbwarp-animation-time');
    dialog.bindAdjustment('rgbwarp-wavesize');
    dialog.bindAdjustment('rgbwarp-brightness');
    dialog.bindAdjustment('rgbwarp-offset-r');
    dialog.bindAdjustment('rgbwarp-offset-g');
    dialog.bindAdjustment('rgbwarp-offset-b');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}