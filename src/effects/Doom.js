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
// This effect melts your windows. Inspired by the legendary screen transitions of the  //
// original Doom.                                                                       //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var Doom = class {

  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.
  constructor() {
    this.shaderFactory = new ShaderFactory(this.getNick(), (shader) => {
      // Store uniform locations of newly created shaders.
      shader._uActorScale      = shader.get_uniform_location('uActorScale');
      shader._uHorizontalScale = shader.get_uniform_location('uHorizontalScale');
      shader._uVerticalScale   = shader.get_uniform_location('uVerticalScale');
      shader._uPixelSize       = shader.get_uniform_location('uPixelSize');

      // Write all uniform values at the start of each animation.
      shader.connect(
        'begin-animation', (shader, settings, forOpening, testMode, actor) => {
          // For this effect, we scale the actor vertically so that it covers the entire
          // screen. This ensures that the melted window will not be cut off.
          let actorScale = 2.0 * Math.max(1.0, global.stage.height / actor.height);

          // If we are currently performing integration test, nothing will be visible in
          // the test images as the animation has passed the center of the window already.
          // To fix this, we set the actor scale to a fixed low value when performing
          // tests.
          // clang-format off
          shader.set_uniform_float(shader._uActorScale,      1, [testMode ? 1.0 : actorScale]);
          shader.set_uniform_float(shader._uHorizontalScale, 1, [testMode ? 50.0 :settings.get_double('doom-horizontal-scale')]);
          shader.set_uniform_float(shader._uVerticalScale,   1, [testMode ? 150.0 : settings.get_double('doom-vertical-scale')]);
          shader.set_uniform_float(shader._uPixelSize,       1, [settings.get_int('doom-pixel-size')]);
          // clang-format on
        });
    });
  }

  // ---------------------------------------------------------------------------- metadata

  // The effect is not available on GNOME Shell 3.36 as it requires scaling of the window
  // actor.
  getMinShellVersion() {
    return [3, 38];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-enable-effect'), and its animation time
  // (e.g. '*-animation-time').
  getNick() {
    return 'doom';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Doom');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  bindPreferences(dialog) {
    dialog.bindAdjustment('doom-animation-time');
    dialog.bindAdjustment('doom-horizontal-scale');
    dialog.bindAdjustment('doom-vertical-scale');
    dialog.bindAdjustment('doom-pixel-size');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  // For this effect, we scale the actor vertically so that it covers the entire screen.
  // This ensures that the melted window will not be cut off.
  getActorScale(settings, forOpening, actor) {
    let actorScale = 2.0 * Math.max(1.0, global.stage.height / actor.height);
    return {x: 1.0, y: actorScale};
  }
}
