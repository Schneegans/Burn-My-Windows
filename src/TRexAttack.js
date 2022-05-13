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
// This effect tears your windows apart with a series of violent scratches!             //
// This effect is not available on GNOME 3.3x, due to the limitation described in the   //
// documentation of vfunc_paint_target further down in this file.                       //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var TRexAttack = class TRexAttack extends Effect {

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
    return 'trex';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('T-Rex Attack');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // and binds all properties to the settings.
  getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource('/ui/gtk4/TRexAttack.ui');

    // Bind all properties.
    dialog.bindAdjustment('trex-animation-time');
    dialog.bindColorButton('claw-scratch-color');
    dialog.bindAdjustment('claw-scratch-scale');
    dialog.bindAdjustment('claw-scratch-count');
    dialog.bindAdjustment('claw-scratch-warp');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('trex-prefs');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  getActorScale(settings) {
    const scale = 1.0 + 0.5 * settings.get_double('claw-scratch-warp');
    return {x: scale, y: scale};
  }

  // This is called from extension.js if the extension is disabled. This should free all
  // static resources.
  cleanUp() {
    super.cleanUp();
    this._clawTexture = null;
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

      // Load the claw texture.
      const clawData    = GdkPixbuf.Pixbuf.new_from_resource('/img/claws.png');
      this._clawTexture = new Clutter.Image();
      this._clawTexture.set_data(clawData.get_pixels(), Cogl.PixelFormat.RGB_888,
                                 clawData.width, clawData.height, clawData.rowstride);


      this._ShaderClass = GObject.registerClass({}, class ShaderClass extends Shader {
        // We use the constructor of the shader to store all required uniform locations.
        _init(effect) {
          super._init(effect);

          this._uClawTexture   = this.get_uniform_location('uClawTexture');
          this._uFlashColor    = this.get_uniform_location('uFlashColor');
          this._uSeed          = this.get_uniform_location('uSeed');
          this._uClawSize      = this.get_uniform_location('uClawSize');
          this._uNumClaws      = this.get_uniform_location('uNumClaws');
          this._uWarpIntensity = this.get_uniform_location('uWarpIntensity');
        }

        // This is called once each  time the shader is used. This can be used to retrieve
        // the configuration from the settings and update all uniforms accordingly.
        beginAnimation(actor, settings, forOpening) {
          super.beginAnimation(actor, settings, forOpening);

          const c =
            Clutter.Color.from_string(settings.get_string('claw-scratch-color'))[1];

          // If we are currently performing integration test, the animation uses a fixed
          // seed.
          const testMode = settings.get_boolean('test-mode');

          // clang-format off
          this.set_uniform_float(this._uFlashColor,    4, [c.red / 255, c.green / 255, c.blue / 255, c.alpha / 255]);
          this.set_uniform_float(this._uSeed,          2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
          this.set_uniform_float(this._uClawSize,      1, [settings.get_double('claw-scratch-scale')]);
          this.set_uniform_float(this._uNumClaws,      1, [settings.get_int('claw-scratch-count')]);
          this.set_uniform_float(this._uWarpIntensity, 1, [settings.get_double('claw-scratch-warp')]);
          // clang-format on
        }

        // This is overridden to bind the claw texture for drawing. Sadly, this seems to
        // be impossible under GNOME 3.3x as this.get_pipeline() is not available. It was
        // called get_target() back then but this is not wrapped in GJS.
        // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
        vfunc_paint_target(node, paint_context) {
          const pipeline = this.get_pipeline();
          pipeline.set_layer_texture(1, this._effect._clawTexture.get_texture());
          pipeline.set_uniform_1i(this._uClawTexture, 1);

          super.vfunc_paint_target(node, paint_context);
        }
      });
    }

    // Finally, return a new instance of the shader class.
    return new this._ShaderClass(this);
  }
}
