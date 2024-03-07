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
// This effect pixelates the window texture and hides the pixels radially, starting     //
// from the pointer position.                                                           //
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
      shader._uPixelSize = shader.get_uniform_location('uPixelSize');
      shader._uStartPos  = shader.get_uniform_location('uStartPos');

      // Write all uniform values at the start of each animation.
      shader.connect(
        'begin-animation', (shader, settings, forOpening, testMode, actor) => {
          // Because the actor position may change after the begin-animation signal is
          // called, we set the uStartPos uniform during the update callback.
          shader._startPointerPos = global.get_pointer();
          shader._actor           = actor;

          shader.set_uniform_float(shader._uPixelSize, 1,
                                   [settings.get_int('pixel-wipe-pixel-size')]);
        });

      // We set the uStartPos uniform during the update callback as the actor position
      // may not be set up properly before the begin animation callback.
      shader.connect('update-animation', (shader) => {
        if (shader._startPointerPos) {
          const [x, y]               = shader._startPointerPos;
          const [ok, localX, localY] = shader._actor.transform_stage_point(x, y);

          if (ok) {
            let startPos = [
              Math.max(0.0, Math.min(1.0, localX / shader._actor.width)),
              Math.max(0.0, Math.min(1.0, localY / shader._actor.height))
            ];
            shader.set_uniform_float(shader._uStartPos, 2, startPos);
          }
        }
      });

      // Make sure to drop the reference to the actor.
      shader.connect('end-animation', (shader) => {
        shader._actor = null;
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
    return 'pixel-wipe';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Pixel Wipe');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    dialog.bindAdjustment('pixel-wipe-animation-time');
    dialog.bindAdjustment('pixel-wipe-pixel-size');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}
