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

import * as utils from '../utils.js';

// We import the ShaderFactory only in the Shell process as it is not required in the
// preferences process. The preferences process does not create any shader instances, it
// only uses the static metadata of the effect.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// This effect splits the window into horizontal slats, like the ones of a venetian     //
// blind. The slats turn shut one after another, from the top to the bottom. Opening a  //
// window plays this animation backwards.                                               //
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
      shader._uSlats       = shader.get_uniform_location('uSlats');
      shader._uDelay       = shader.get_uniform_location('uDelay');
      shader._uPerspective = shader.get_uniform_location('uPerspective');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        // clang-format off
        shader.set_uniform_float(shader._uSlats,       1, [settings.get_int('venetian-blinds-slats')]);
        shader.set_uniform_float(shader._uDelay,       1, [settings.get_double('venetian-blinds-delay')]);
        shader.set_uniform_float(shader._uPerspective, 1, [settings.get_boolean('venetian-blinds-perspective')]);
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
    return 'venetian-blinds';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Venetian Blinds');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    dialog.bindAdjustment('venetian-blinds-animation-time');
    dialog.bindAdjustment('venetian-blinds-slats');
    dialog.bindAdjustment('venetian-blinds-delay');
    dialog.bindSwitch('venetian-blinds-perspective');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}
