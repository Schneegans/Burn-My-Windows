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
// This effect shatters the window into pieces. For an explanation how this works, look //
// further down in this file into the documentation of the Shader class. This effect is //
// not available on GNOME 3.3x, due to the limitation described in the documentation    //
// of vfunc_paint_target further down in this file.                                     //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var BrokenGlass = class BrokenGlass extends Effect {

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
    return 'broken-glass';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Broken Glass');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // and binds all properties to the settings.
  getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource('/ui/gtk4/BrokenGlass.ui');

    // Bind all properties.
    dialog.bindAdjustment('broken-glass-animation-time');
    dialog.bindAdjustment('broken-glass-scale');
    dialog.bindAdjustment('broken-glass-gravity');
    dialog.bindAdjustment('broken-glass-blow-force');
    dialog.bindSwitch('broken-glass-use-pointer');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('broken-glass-prefs');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  getActorScale(settings) {
    return {x: 2.0, y: 2.0};
  }

  // This is called from extension.js if the extension is disabled. This should free all
  // static resources.
  cleanUp() {
    super.cleanUp();
    this._shardTexture = null;
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

      const shardData    = GdkPixbuf.Pixbuf.new_from_resource('/img/shards.png');
      this._shardTexture = new Clutter.Image();
      this._shardTexture.set_data(shardData.get_pixels(), Cogl.PixelFormat.RGB_888,
                                  shardData.width, shardData.height, shardData.rowstride);

      // This shader creates a complex-looking effect with rather simple means. Here is
      // how it works: The window is drawn five times on top of each other (see the
      // SHARD_LAYERS constant in the GLSL code). Each layer only draws some of the
      // shards, all layers combined make up the entire window. The layers are then
      // scaled, rotated, and moved independently from each other - this creates the
      // impression that all shards are moving independently. In reality, there are only
      // five groups of shards! Which shard belongs to which layer is defined by the green
      // channel of the texture resources/img/shards.png. The red channel of the texture
      // contains the distance to the shard edges. This information is used to fade out
      // the shards.
      this._ShaderClass = GObject.registerClass({}, class ShaderClass extends Shader {
        // We use the constructor of the shader to store all required uniform locations.
        _init(effect) {
          super._init(effect);

          this._uShardTexture = this.get_uniform_location('uShardTexture');
          this._uSeed         = this.get_uniform_location('uSeed');
          this._uEpicenter    = this.get_uniform_location('uEpicenter');
          this._uShardScale   = this.get_uniform_location('uShardScale');
          this._uBlowForce    = this.get_uniform_location('uBlowForce');
          this._uGravity      = this.get_uniform_location('uGravity');
        }

        // This is called once each  time the shader is used. This can be used to retrieve
        // the configuration from the settings and update all uniforms accordingly.
        beginAnimation(actor, settings, forOpening) {
          super.beginAnimation(actor, settings, forOpening);

          // Usually, the shards fly away from the center of the window.
          let epicenterX = 0.5;
          let epicenterY = 0.5;

          // However, if this option is set, we use the mouse pointer position.
          if (!forOpening && settings.get_boolean('broken-glass-use-pointer')) {
            const [x, y]               = global.get_pointer();
            const [ok, localX, localY] = actor.transform_stage_point(x, y);

            if (ok) {
              epicenterX = localX / actor.width;
              epicenterY = localY / actor.height;
            }
          }

          // If we are currently performing integration test, the animation uses a fixed
          // seed.
          const testMode = settings.get_boolean('test-mode');

          // clang-format off
          this.set_uniform_float(this._uSeed,       2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
          this.set_uniform_float(this._uEpicenter,  2, [epicenterX, epicenterY]);
          this.set_uniform_float(this._uShardScale, 1, [settings.get_double('broken-glass-scale')]);
          this.set_uniform_float(this._uBlowForce,  1, [settings.get_double('broken-glass-blow-force')]);
          this.set_uniform_float(this._uGravity,    1, [settings.get_double('broken-glass-gravity')]);
          // clang-format on
        }

        // This is overridden to bind the shard texture for drawing. Sadly, this seems to
        // be impossible under GNOME 3.3x as this.get_pipeline() is not available. It was
        // called get_target() back then but this is not wrapped in GJS.
        // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
        vfunc_paint_target(node, paint_context) {
          const pipeline = this.get_pipeline();

          // Use linear filtering for the window texture.
          pipeline.set_layer_filters(0, Cogl.PipelineFilter.LINEAR,
                                     Cogl.PipelineFilter.LINEAR);

          // Bind the shard texture.
          pipeline.set_layer_texture(1, this._effect._shardTexture.get_texture());
          pipeline.set_layer_wrap_mode(1, Cogl.PipelineWrapMode.REPEAT);
          pipeline.set_uniform_1i(this._uShardTexture, 1);

          super.vfunc_paint_target(node, paint_context);
        }
      });
    }

    // Finally, return a new instance of the shader class.
    return new this._ShaderClass(this);
  }
}
