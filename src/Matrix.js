//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//                       Copyright (c) 2021 Simon Schneegans                            //
//          Released under the GPLv3 or later. See LICENSE file for details.            //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const GObject = imports.gi.GObject;

const _ = imports.gettext.domain('burn-my-windows').gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;
const Effect         = Me.imports.src.Effect.Effect;

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
var Matrix = class Matrix extends Effect {

  // ---------------------------------------------------------------------------- metadata

  // This effect is only available on GNOME Shell 40+.
  getMinShellVersion() {
    return [40, 0];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-close-effect'), and its animation time
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

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // and binds all properties to the settings.
  getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource('/ui/gtk4/Matrix.ui');

    // Bind all properties.
    dialog.bindAdjustment('matrix-animation-time');
    dialog.bindAdjustment('matrix-scale');
    dialog.bindAdjustment('matrix-randomness');
    dialog.bindAdjustment('matrix-overshoot');
    dialog.bindColorButton('matrix-trail-color');
    dialog.bindColorButton('matrix-tip-color');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('matrix-prefs');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  getActorScale(settings) {
    return {x: 1.0, y: 1.0 + settings.get_double('matrix-overshoot')};
  }

  // This is called from extension.js if the extension is disabled. This should free all
  // static resources.
  cleanUp() {
    super.cleanUp();
    this._fontTexture = null;
  }

  // This is called by the effect's base class whenever a new shader is required. Since
  // this shader depends on classes by GNOME Shell, we register it locally in this method
  // as this file is also included from the preferences dialog where those classes would
  // not be available.
  createShader() {

    // Only register the shader class when this method is called for the first time.
    if (!this._ShaderClass) {

      const {Clutter, GdkPixbuf, Cogl} = imports.gi;
      const Shader                     = Me.imports.src.Shader.Shader;

      const fontData    = GdkPixbuf.Pixbuf.new_from_resource('/img/matrixFont.png');
      this._fontTexture = new Clutter.Image();
      this._fontTexture.set_data(
        fontData.get_pixels(),
        fontData.has_alpha ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
        fontData.width, fontData.height, fontData.rowstride);

      this._ShaderClass = GObject.registerClass({}, class ShaderClass extends Shader {
        // We use the constructor of the shader to store all required uniform locations.
        _init(effect) {
          super._init(effect);

          this._uFontTexture = this.get_uniform_location('uFontTexture');
          this._uTrailColor  = this.get_uniform_location('uTrailColor');
          this._uTipColor    = this.get_uniform_location('uTipColor');
          this._uLetterSize  = this.get_uniform_location('uLetterSize');
          this._uRandomness  = this.get_uniform_location('uRandomness');
          this._uOverShoot   = this.get_uniform_location('uOverShoot');
        }

        // This is called once each  time the shader is used. This can be used to retrieve
        // the configuration from the settings and update all uniforms accordingly.
        beginAnimation(actor, settings, forOpening) {
          super.beginAnimation(actor, settings, forOpening);

          const c1 =
            Clutter.Color.from_string(settings.get_string('matrix-trail-color'))[1];
          const c2 =
            Clutter.Color.from_string(settings.get_string('matrix-tip-color'))[1];

          // clang-format off
          this.set_uniform_float(this._uTrailColor, 3, [c1.red / 255, c1.green / 255, c1.blue / 255]);
          this.set_uniform_float(this._uTipColor,   3, [c2.red / 255, c2.green / 255, c2.blue / 255]);
          this.set_uniform_float(this._uLetterSize, 1, [settings.get_int('matrix-scale')]);
          this.set_uniform_float(this._uRandomness, 1, [settings.get_double('matrix-randomness')]);
          this.set_uniform_float(this._uOverShoot,  1, [settings.get_double('matrix-overshoot')]);
          // clang-format on
        }

        // This is overridden to bind the font texture for drawing. Sadly, this seems to
        // be impossible under GNOME 3.3x as this.get_pipeline() is not available. It was
        // called get_target() back then but this is not wrapped in GJS.
        // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
        vfunc_paint_target(node, paint_context) {
          const pipeline = this.get_pipeline();
          pipeline.set_layer_texture(1, this._effect._fontTexture.get_texture());
          pipeline.set_uniform_1i(this._uFontTexture, 1);

          super.vfunc_paint_target(node, paint_context);
        }
      });
    }

    // Finally, return a new instance of the shader class.
    return new this._ShaderClass(this);
  }
}
