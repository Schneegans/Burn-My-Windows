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
// The Matrix shader multiplies a grid of random letters with some gradients which are  //
// moving from top to bottom. The speed of the moving gradients is chosen randomly.     //
// Also, there is a random delay making the gradients not drop all at the same time.    //
// This effect is not available on GNOME 3.3x, due to the limitation described in the   //
// documentation of vfunc_paint_target further down in this file.                       //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var Matrix = class {

  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.
  constructor() {
    this.shaderFactory = new ShaderFactory(this.getNick(), (shader) => {
      // We import these modules in this function as they are not available in the
      // preferences process. This callback is only called within GNOME Shell's process.
      const {Clutter, GdkPixbuf, Cogl} = imports.gi;

      // Create the texture in the first call.
      if (!this._fontTexture) {
        const fontData    = GdkPixbuf.Pixbuf.new_from_resource('/img/matrixFont.png');
        this._fontTexture = new Clutter.Image();
        this._fontTexture.set_data(
          fontData.get_pixels(),
          fontData.has_alpha ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
          fontData.width, fontData.height, fontData.rowstride);
      }

      // Store uniform locations of newly created shaders.
      shader._uFontTexture = shader.get_uniform_location('uFontTexture');
      shader._uTrailColor  = shader.get_uniform_location('uTrailColor');
      shader._uTipColor    = shader.get_uniform_location('uTipColor');
      shader._uLetterSize  = shader.get_uniform_location('uLetterSize');
      shader._uRandomness  = shader.get_uniform_location('uRandomness');
      shader._uOverShoot   = shader.get_uniform_location('uOverShoot');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        const c1 =
          Clutter.Color.from_string(settings.get_string('matrix-trail-color'))[1];
        const c2 = Clutter.Color.from_string(settings.get_string('matrix-tip-color'))[1];

        // clang-format off
        shader.set_uniform_float(shader._uTrailColor, 3, [c1.red / 255, c1.green / 255, c1.blue / 255]);
        shader.set_uniform_float(shader._uTipColor,   3, [c2.red / 255, c2.green / 255, c2.blue / 255]);
        shader.set_uniform_float(shader._uLetterSize, 1, [settings.get_int('matrix-scale')]);
        shader.set_uniform_float(shader._uRandomness, 1, [settings.get_double('matrix-randomness')]);
        shader.set_uniform_float(shader._uOverShoot,  1, [settings.get_double('matrix-overshoot')]);
        // clang-format on
      });

      // This is required to bind the font texture for drawing. Sadly, this seems to be
      // impossible under GNOME 3.3x as this.get_pipeline() is not available. It was
      // called get_target() back then but this is not wrapped in GJS.
      // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
      shader.connect('update-animation', (shader) => {
        const pipeline = shader.get_pipeline();

        // Bind the font texture.
        pipeline.set_layer_texture(1, this._fontTexture.get_texture());
        pipeline.set_uniform_1i(shader._uFontTexture, 1);
      });
    });
  }

  // ---------------------------------------------------------------------------- metadata

  // This effect is only available on GNOME Shell 40+.
  getMinShellVersion() {
    return [40, 0];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-enable-effect'), and its animation time
  // (e.g. '*-animation-time').
  getNick() {
    return 'matrix';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Matrix');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  bindPreferences(dialog) {
    dialog.bindAdjustment('matrix-animation-time');
    dialog.bindAdjustment('matrix-scale');
    dialog.bindAdjustment('matrix-randomness');
    dialog.bindAdjustment('matrix-overshoot');
    dialog.bindColorButton('matrix-trail-color');
    dialog.bindColorButton('matrix-tip-color');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  getActorScale(settings) {
    return {x: 1.0, y: 1.0 + settings.get_double('matrix-overshoot')};
  }
}
