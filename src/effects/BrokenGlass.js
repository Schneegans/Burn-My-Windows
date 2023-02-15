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

const _ = imports.gettext.domain('burn-my-windows').gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;
const ShaderFactory  = Me.imports.src.ShaderFactory.ShaderFactory;

//////////////////////////////////////////////////////////////////////////////////////////
// This effect shatters the window into pieces. For an explanation how this works, look //
// further down in this file into the documentation of the Shader class. This effect is //
// not available on GNOME 3.3x, due to the limitation described in the documentation    //
// of vfunc_paint_target further down in this file.                                     //
// This shader creates a complex-looking effect with rather simple means. Here is how   //
// it works: The window is drawn five times on top of each other (see the SHARD_LAYERS  //
// constant in the GLSL code). Each layer only draws some of the shards, all layers     //
// combined make up the entire window. The layers are then scaled, rotated, and moved   //
// independently from each other - this creates the impression that all shards are      //
// moving independently. In reality, there are only five groups of shards! Which shard  //
// belongs to which layer is defined by the green channel of the texture                //
// resources/img/shards.png. The red channel of the texture contains the distance to    //
// the shard edges. This information is used to fade out the shards.                    //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var BrokenGlass = class {

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
      if (!this._shardTexture) {
        const shardData    = GdkPixbuf.Pixbuf.new_from_resource('/img/shards.png');
        this._shardTexture = new Clutter.Image();
        this._shardTexture.set_data(shardData.get_pixels(), Cogl.PixelFormat.RGB_888,
                                    shardData.width, shardData.height,
                                    shardData.rowstride);
      }

      // Store all uniform locations.
      shader._uShardTexture = shader.get_uniform_location('uShardTexture');
      shader._uSeed         = shader.get_uniform_location('uSeed');
      shader._uEpicenter    = shader.get_uniform_location('uEpicenter');
      shader._uShardScale   = shader.get_uniform_location('uShardScale');
      shader._uBlowForce    = shader.get_uniform_location('uBlowForce');
      shader._uGravity      = shader.get_uniform_location('uGravity');

      // And update all uniforms at the start of each animation.
      shader.connect(
        'begin-animation', (shader, settings, forOpening, testMode, actor) => {
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

          // clang-format off
          shader.set_uniform_float(shader._uSeed,       2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
          shader.set_uniform_float(shader._uEpicenter,  2, [epicenterX, epicenterY]);
          shader.set_uniform_float(shader._uShardScale, 1, [settings.get_double('broken-glass-scale')]);
          shader.set_uniform_float(shader._uBlowForce,  1, [settings.get_double('broken-glass-blow-force')]);
          shader.set_uniform_float(shader._uGravity,    1, [settings.get_double('broken-glass-gravity')]);
          // clang-format on
        });

      // This is required to bind the shard texture for drawing. Sadly, this seems to be
      // impossible under GNOME 3.3x as this.get_pipeline() is not available. It was
      // called get_target() back then but this is not wrapped in GJS.
      // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
      shader.connect('update-animation', (shader) => {
        const pipeline = shader.get_pipeline();

        // Use linear filtering for the window texture.
        pipeline.set_layer_filters(0, Cogl.PipelineFilter.LINEAR,
                                   Cogl.PipelineFilter.LINEAR);

        // Bind the shard texture.
        pipeline.set_layer_texture(1, this._shardTexture.get_texture());
        pipeline.set_layer_wrap_mode(1, Cogl.PipelineWrapMode.REPEAT);
        pipeline.set_uniform_1i(shader._uShardTexture, 1);
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
  // (e.g. '*-animation-time'). Also, the shader file and the settings UI files should be
  // named likes this.
  getNick() {
    return 'broken-glass';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Broken Glass');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  bindPreferences(dialog) {
    dialog.bindAdjustment('broken-glass-animation-time');
    dialog.bindAdjustment('broken-glass-scale');
    dialog.bindAdjustment('broken-glass-gravity');
    dialog.bindAdjustment('broken-glass-blow-force');
    dialog.bindSwitch('broken-glass-use-pointer');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  getActorScale(settings) {
    return {x: 2.0, y: 2.0};
  }
}
