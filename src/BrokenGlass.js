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

//////////////////////////////////////////////////////////////////////////////////////////
// This effect shatters the window into pieces. For an explanation how this works, look //
// further down in this file into the documentation of the Shader class. This effect is //
// not available on GNOME 3.3x, due to the limitation described in the documentation    //
// of vfunc_paint_target further down in this file.                                     //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let Shader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var BrokenGlass = class BrokenGlass {

  // ---------------------------------------------------------------------------- metadata

  // This effect is only available on GNOME Shell 40+.
  static getMinShellVersion() {
    return [40, 0];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-close-effect'), and its animation time
  // (e.g. '*-animation-time').
  static getNick() {
    return 'broken-glass';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Broken Glass');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static getPreferences(dialog) {

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

  // This is called from extension.js whenever a window is closed with this effect.
  static createShader(actor, settings, forOpening) {
    return new Shader(actor, settings, forOpening);
  }

  // The tweakTransition() is called from extension.js to tweak a window's open / close
  // transitions - usually windows are faded in / out and scaled up / down by GNOME Shell.
  // The parameter 'forOpening' is set to true if this is called for a window-open
  // transition, for a window-close transition it is set to false. The modes can be set to
  // any value from here: https://gjs-docs.gnome.org/clutter8~8_api/clutter.animationmode.
  // The only required property is 'opacity', even if it transitions from 1.0 to 1.0. The
  // current value of the opacity transition is passed as uProgress to the shader.
  // Tweaking the actor's scale during the transition only works properly for GNOME 3.38+.

  // For this effect, windows are set to twice their original size, so that
  // we have some space to draw the shards. We also set the animation mode to "Linear".
  static tweakTransition(actor, settings, forOpening) {
    return {
      'opacity': {from: 255, to: 255, mode: 1},
      'scale-x': {from: 2.0, to: 2.0, mode: 1},
      'scale-y': {from: 2.0, to: 2.0, mode: 1}
    };
  }
}


//////////////////////////////////////////////////////////////////////////////////////////
// The shader class for this effect will only be registered in GNOME Shell's process    //
// (not in the preferences process). It's done this way as Clutter may not be installed //
// on the system and therefore the preferences would crash.                             //
//////////////////////////////////////////////////////////////////////////////////////////

if (utils.isInShellProcess()) {

  const {Clutter, GdkPixbuf, Cogl} = imports.gi;
  const shaderSnippets             = Me.imports.src.shaderSnippets;

  // This shader creates a complex-looking effect with rather simple means. Here is how it
  // works: The window is drawn five times on top of each other (see the SHARD_LAYERS
  // constant in the GLSL code). Each layer only draws some of the shards, all layers
  // combined make up the entire window. The layers are then scaled, rotated, and moved
  // independently from each other - this creates the impression that all shards are
  // moving independently. In reality, there are only five groups of shards! Which shard
  // belongs to which layer is defined by the green channel of the texture
  // resources/img/shards.png. The red channel of the texture contains the distance to the
  // shard edges. This information is used to fade out the shards.
  Shader = GObject.registerClass({}, class Shader extends Clutter.ShaderEffect {
    _init(actor, settings, forOpening) {
      super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

      // Load the shards texture. As the shader is re-created for each window animation,
      // this texture is also re-created each time. This could be improved in the future!
      const shardData    = GdkPixbuf.Pixbuf.new_from_resource('/img/shards.png');
      this._shardTexture = new Clutter.Image();
      this._shardTexture.set_data(shardData.get_pixels(), Cogl.PixelFormat.RGB_888,
                                  shardData.width, shardData.height, shardData.rowstride);

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

      // If we are currently performing integration test, the animation uses a fixed seed.
      const testMode = settings.get_boolean('test-mode');

      this.set_shader_source(`

        // Inject some common shader snippets.
        ${shaderSnippets.standardUniforms()}

        uniform sampler2D uShardTexture;

        const vec2  SEED         = vec2(${testMode ? 0 : Math.random()}, 
                                        ${testMode ? 0 : Math.random()});
        const float SHARD_SCALE  = ${settings.get_double('broken-glass-scale')};
        const float SHARD_LAYERS = 5;
        const float BLOW_FORCE   = ${settings.get_double('broken-glass-blow-force')};
        const float ACTOR_SCALE  = 2.0;
        const float PADDING      = ACTOR_SCALE / 2.0 - 0.5;
        const vec2  EPICENTER    = vec2(${epicenterX}, ${epicenterY});
        const float GRAVITY      = ${forOpening ? '-1.0' : '1.0'} * 
                                   ${settings.get_double('broken-glass-gravity')};

        void main() {

          cogl_color_out = vec4(0, 0, 0, 0);

          float progress = ${forOpening ? '1.0-uProgress' : 'uProgress'};

          // Draw the individual shard layers.
          for (float i=0; i<SHARD_LAYERS; ++i) {

            // To enable drawing shards outside of the window bounds, the actor was scaled
            // by ACTOR_SCALE. Here we scale and move the texture coordinates so that the
            // window gets drawn at the correct position again.
            vec2 coords = cogl_tex_coord_in[0].st * ACTOR_SCALE - PADDING;

            // Scale and rotate around our epicenter.
            coords -= EPICENTER;

            // Scale each layer a bit differently.
            coords /= mix(1.0, 1.0 + BLOW_FORCE*(i+2)/SHARD_LAYERS, progress);
            
            // Rotate each layer a bit differently.
            float rotation = (mod(i, 2.0)-0.5)*0.2*progress;
            coords = vec2(coords.x * cos(rotation) - coords.y * sin(rotation),
            coords.x * sin(rotation) + coords.y * cos(rotation));
            
            // Move down each layer a bit.
            float gravity = GRAVITY*0.1*(i+1)*progress*progress;
            coords += vec2(0, gravity);

            // Restore correct position.
            coords += EPICENTER;
            
            // Retrieve information from the shard texture for our layer.
            vec2 shardCoords = (coords + SEED) * vec2(uSizeX, uSizeY) / SHARD_SCALE / 500.0;
            vec2 shardMap = texture2D(uShardTexture, shardCoords).rg;

            // The green channel contains a random value in [0..1] for each shard. We
            // discretize this into SHARD_LAYERS bins and check if our layer falls into
            // the bin of the current shard.
            float shardGroup = floor(shardMap.g * SHARD_LAYERS * 0.999);

            if (shardGroup == i) {
              vec4 windowColor = texture2D(uTexture, coords);

              // Dissolve the shard by using distance information from the red channel.
              float dissolve = (shardMap.x - pow(progress+0.1, 2)) > 0 ? 1: 0;
              cogl_color_out = mix(cogl_color_out, windowColor, dissolve);
            }
          }
        }
      `);
    };

    // This is overridden to bind the shard texture for drawing. Sadly, this seems to be
    // impossible under GNOME 3.3x as this.get_pipeline() is not available. It was called
    // get_target() back then but this is not wrapped in GJS.
    // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
    vfunc_paint_target(node, paint_context) {
      const pipeline = this.get_pipeline();

      // Use linear filtering for the window texture.
      pipeline.set_layer_filters(0, Cogl.PipelineFilter.LINEAR,
                                 Cogl.PipelineFilter.LINEAR);

      // Bind the shard texture.
      pipeline.set_layer_texture(1, this._shardTexture.get_texture());
      pipeline.set_layer_wrap_mode(1, Cogl.PipelineWrapMode.REPEAT);
      this.set_uniform_value('uShardTexture', 1);

      super.vfunc_paint_target(node, paint_context);
    }
  });
}