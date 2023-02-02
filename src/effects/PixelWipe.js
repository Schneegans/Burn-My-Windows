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

const GObject = imports.gi.GObject;

const _ = imports.gettext.domain('burn-my-windows').gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;
const ShaderFactory  = Me.imports.src.ShaderFactory.ShaderFactory;

//////////////////////////////////////////////////////////////////////////////////////////
// This effect pixelates the window texture and hides the pixels radially, starting     //
// from the pointer position.                                                           //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var PixelWipe = class {

  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.
  constructor() {
    this.shaderFactory = new ShaderFactory(this.getNick(), (shader) => {
      // Store uniform locations of newly created shaders.
      shader._uPixelSize = shader.get_uniform_location('uPixelSize');
      shader._uStartPos  = shader.get_uniform_location('uStartPos');

      // Write all uniform values at the start of each animation.
      shader.connect(
        'begin-animation', (shader, settings, forOpening, testMode, actor) => {
          // Because the actor position may change after the begin-animation signal is
          // called, we set the uStartPos uniform during the update callback.
          this._startPointerPos = global.get_pointer();
          this._actor           = actor;

          // clang-format off
        shader.set_uniform_float(shader._uPixelSize, 1, [settings.get_int('pixel-wipe-pixel-size')]);
          // clang-format on
        });

      // We set the uStartPos uniform during the update callback as the actor position
      // may not be set up properly before the begin animation callback.
      shader.connect('update-animation', (shader) => {
        if (this._startPointerPos) {
          const [x, y]               = this._startPointerPos;
          const [ok, localX, localY] = this._actor.transform_stage_point(x, y);

          if (ok) {
            let startPos = [
              Math.max(0.0, Math.min(1.0, localX / this._actor.width)),
              Math.max(0.0, Math.min(1.0, localY / this._actor.height))
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
  getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-enable-effect'), and its animation time
  // (e.g. '*-animation-time').
  getNick() {
    return 'pixel-wipe';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Pixel Wipe');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  bindPreferences(dialog) {
    dialog.bindAdjustment('pixel-wipe-animation-time');
    dialog.bindAdjustment('pixel-wipe-pixel-size');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  getActorScale(settings) {
    return {x: 1.0, y: 1.0};
  }
}
