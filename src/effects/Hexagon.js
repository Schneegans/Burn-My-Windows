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
// This effect overlays a glowing hexagonal grid over the window. The grid cells then   //
// gradually shrink until the window is fully dissolved.                                //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var Hexagon = class {

  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.
  constructor() {
    this.shaderFactory = new ShaderFactory(this.getNick(), (shader) => {
      // We import Clutter in this function as it is not available in the preferences
      // process. This creator function of the ShaderFactory is only called within GNOME
      // Shell's process.
      const Clutter = imports.gi.Clutter;

      // Store uniform locations of newly created shaders.
      shader._uAdditiveBlending = shader.get_uniform_location('uAdditiveBlending');
      shader._uSeed             = shader.get_uniform_location('uSeed');
      shader._uScale            = shader.get_uniform_location('uScale');
      shader._uLineWidth        = shader.get_uniform_location('uLineWidth');
      shader._uGlowColor        = shader.get_uniform_location('uGlowColor');
      shader._uLineColor        = shader.get_uniform_location('uLineColor');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings, forOpening, testMode) => {
        // Get the two configurable colors. They are directly injected into the shader
        // code below.
        const gc =
          Clutter.Color.from_string(settings.get_string('hexagon-glow-color'))[1];
        const lc =
          Clutter.Color.from_string(settings.get_string('hexagon-line-color'))[1];

        // clang-format off
        shader.set_uniform_float(shader._uAdditiveBlending, 1, [settings.get_boolean('hexagon-additive-blending')]);
        shader.set_uniform_float(shader._uSeed,             2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
        shader.set_uniform_float(shader._uScale,            1, [settings.get_double('hexagon-scale')]);
        shader.set_uniform_float(shader._uLineWidth,        1, [settings.get_double('hexagon-line-width')]);
        shader.set_uniform_float(shader._uGlowColor,        4, [gc.red / 255, gc.green / 255, gc.blue / 255, gc.alpha / 255]);
        shader.set_uniform_float(shader._uLineColor,        4, [lc.red / 255, lc.green / 255, lc.blue / 255, lc.alpha / 255]);
        // clang-format on
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
    return 'hexagon';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Hexagon');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  bindPreferences(dialog) {
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
  getActorScale(settings) {
    return {x: 1.0, y: 1.0};
  }
}
