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

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// ...                                                                                  //
// This effect is not available on GNOME 3.3x, due to the limitation described in the   //
// documentation of vfunc_paint_target further down in this file.                       //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let Shader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var SnapOfDisintegration = class SnapOfDisintegration {

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
    return 'snap';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return 'Snap of Disintegration';
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource('/ui/gtk4/SnapOfDisintegration.ui');

    // Bind all properties.
    dialog.bindAdjustment('snap-animation-time');
    dialog.bindAdjustment('snap-scale');
    dialog.bindColorButton('snap-color');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('snap-prefs');
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is closed with this effect.
  static createShader(actor, settings) {
    return new Shader(actor, settings);
  }

  // This is also called from extension.js. It is used to tweak the ongoing transition of
  // the actor - usually windows are faded to transparency and scaled down slightly by
  // GNOME Shell. For this effect, windows are set to twice their original size, so that
  // we have some space to draw the dust.
  static getCloseTransition(actor, settings) {
    return {
      'opacity': {to: 255},
      'scale-x': {from: 2.0, to: 2.0},
      'scale-y': {from: 2.0, to: 2.0}
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

  Shader = GObject.registerClass({}, class Shader extends Clutter.ShaderEffect {
    _init(actor, settings) {
      super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

      // Load the claw texture. As the shader is re-created for each window animation,
      // this texture is also re-created each time. This could be improved in the future!
      const dustData    = GdkPixbuf.Pixbuf.new_from_resource('/img/dust.png');
      this._dustTexture = new Clutter.Image();
      this._dustTexture.set_data(
          dustData.get_pixels(), Cogl.PixelFormat.RGB_888, dustData.width,
          dustData.height, dustData.rowstride);

      const color = Clutter.Color.from_string(settings.get_string('snap-color'))[1];

      this.set_shader_source(`

        // Inject some common shader snippets.
        ${shaderSnippets.standardUniforms()}

        uniform sampler2D uDustTexture;

        const vec2  SEED         = vec2(${Math.random()}, ${Math.random()});
        const float DUST_SCALE   = ${settings.get_double('snap-scale')};
        const float DUST_LAYERS  = 5;
        const float ACTOR_SCALE  = 2.0;
        const float PADDING      = ACTOR_SCALE / 2.0 - 0.5;
        const vec3  DUST_COLOR   = vec3(${color.red / 255},
                                        ${color.green / 255},
                                        ${color.blue / 255});

        void main() {

          float progress = pow(uProgress, 2.0);

          cogl_color_out = vec4(0, 0, 0, 0);

          for (float i=0; i<DUST_LAYERS; ++i) {

            float factor = DUST_LAYERS == 1 ? 0 : i/(DUST_LAYERS-1);

            vec2 coords = cogl_tex_coord_in[0].st * ACTOR_SCALE - PADDING;
            
            vec2 distort = vec2(cos(progress * (i+1) + coords.y * (i+1)) * 0.05 - sin(progress) * 0.1, -progress*mix(0.3, 0.5, factor));
            coords += distort * progress;
         
            vec2 dustCoords = (coords + SEED) * vec2(uSizeX, uSizeY) * DUST_SCALE / 100.0;
            vec2 dustMap = texture2D(uDustTexture, dustCoords).rg;

            float dustGroup = floor(dustMap.g * DUST_LAYERS * 0.999);

            if (dustGroup == i) {
              vec4 windowColor = texture2D(uTexture, coords);
              windowColor.rgb = mix(windowColor.rgb, DUST_COLOR*windowColor.a, progress);
              float dissolve = (dustMap.x - pow(progress, 5)) > 0 ? 1: 0;
              cogl_color_out = mix(cogl_color_out, windowColor, dissolve);
            }
          }
        }
      `);
    };

    // This is overridden to bind the dust texture for drawing. Sadly, this seems to be
    // impossible under GNOME 3.3x as this.get_pipeline() is not available. It was called
    // get_target() back then but this is not wrapped in GJS.
    // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
    vfunc_paint_target(node, paint_context) {
      const pipeline = this.get_pipeline();
      pipeline.set_layer_filters(
          0, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
      pipeline.set_layer_texture(1, this._dustTexture.get_texture());
      pipeline.set_layer_wrap_mode(1, Cogl.PipelineWrapMode.REPEAT);
      this.set_uniform_value('uDustTexture', 1);
      super.vfunc_paint_target(node, paint_context);
    }
  });
}