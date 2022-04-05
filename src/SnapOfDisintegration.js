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
// This effects dissolves your windows into a cloud of dust. For this, it uses an       //
// approach similar to the Broken Glass effect. A dust texture is used to segment the   //
// window texture into a set of layers. Each layer is then moved, sheared and scaled    //
// randomly. Just a few layers are sufficient to create the illusion of many individual //
// dust particles.                                                                      //
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
    return _('Snap of Disintegration');
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

  // For this effect, windows are set to 1.2 times their original size, so that we have
  // some space to draw the dust particles. We also set the animation mode to "Linear".
  static tweakTransition(actor, settings, forOpening) {
    return {
      'opacity': {from: 255, to: 255, mode: 1},
      'scale-x': {from: 1.2, to: 1.2, mode: 1},
      'scale-y': {from: 1.2, to: 1.2, mode: 1}
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
    _init(actor, settings, forOpening) {
      super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

      // Load the dust texture. As the shader is re-created for each window animation,
      // this texture is also re-created each time. This could be improved in the future!
      const dustData    = GdkPixbuf.Pixbuf.new_from_resource('/img/dust.png');
      this._dustTexture = new Clutter.Image();
      this._dustTexture.set_data(dustData.get_pixels(), Cogl.PixelFormat.RGB_888,
                                 dustData.width, dustData.height, dustData.rowstride);

      // The dust particles will fade to this color over time.
      const color = Clutter.Color.from_string(settings.get_string('snap-color'))[1];

      // If we are currently performing integration test, the animation uses a fixed seed.
      const testMode = settings.get_boolean('test-mode');

      this.set_shader_source(`

        // Inject some common shader snippets.
        ${shaderSnippets.standardUniforms()}
        ${shaderSnippets.noise()}
        ${shaderSnippets.math2D()}

        uniform sampler2D uDustTexture;

        const vec2  SEED             = vec2(${testMode ? 0 : Math.random()}, 
                                            ${testMode ? 0 : Math.random()});
        const float DUST_SCALE       = ${settings.get_double('snap-scale')};
        const float DUST_LAYERS      = 4;
        const float GROW_INTENSITY   = 0.05;
        const float SHRINK_INTENSITY = 0.05;
        const float WIND_INTENSITY   = 0.05;
        const float ACTOR_SCALE      = 1.2;
        const float PADDING          = ACTOR_SCALE / 2.0 - 0.5;
        const vec4  DUST_COLOR       = vec4(${color.red / 255},  ${color.green / 255},
                                            ${color.blue / 255}, ${color.alpha / 255});
        void main() {

          // We simply inverse the progress for opening windows.
          float progress = ${forOpening ? 'uProgress' : '1.0 - uProgress'};

          float gradient = cogl_tex_coord_in[0].t * ACTOR_SCALE - PADDING;
          progress = 2.0 - gradient - 2.0 * progress;
          progress = progress + 0.25 - 0.5 * simplex2D((cogl_tex_coord_in[0].st + SEED) * 2.0);
          progress = pow(max(0, progress), 2.0);

          // This may help you to understand how this effect works.
          // cogl_color_out = vec4(progress, 0, 0, 0);
          // return;

          cogl_color_out = vec4(0, 0, 0, 0);

          for (float i=0; i<DUST_LAYERS; ++i) {
            
            // Create a random direction.
            float factor   = DUST_LAYERS == 1 ? 0 : i/(DUST_LAYERS-1);
            float angle    = 123.123 * (SEED.x + factor);
            vec2 direction = vec2(1.0, 0.0);
            direction      = rotate(direction, angle);
            
            // Flip direction for one side of the window.
            vec2 coords = cogl_tex_coord_in[0].st * ACTOR_SCALE - PADDING - 0.5;
            if (getWinding(direction, coords) > 0) {
              direction *= -1;
            }

            // Flip direction for half the layers.
            if (factor > 0.5) {
              direction *= -1;
            }
            
            // We grow the layer along the random direction, shrink it orthogonally to it
            // and scale it up slightly.
            float dist  = distToLine(vec2(0.0), direction, coords);
            vec2 grow   = direction * dist * mix(0, GROW_INTENSITY, progress);
            vec2 shrink = vec2(direction.y, -direction.x) * dist * mix(0, SHRINK_INTENSITY, progress);
            float scale = mix(1.0, 1.05, factor * progress);
            coords = (coords + grow + shrink) / scale;

            // Add some wind.
            coords.x = coords.x ${forOpening ? ' + ' : ' - '} progress * WIND_INTENSITY;
         
            // Now check wether there is actually something in the current dust layer at
            // the coords position.
            vec2 dustCoords = (coords + SEED) * vec2(uSizeX, uSizeY) / DUST_SCALE / 100.0;
            vec2 dustMap    = texture2D(uDustTexture, dustCoords).rg;
            float dustGroup = floor(dustMap.g * DUST_LAYERS * 0.999);

            if (dustGroup == i) {

              // Fade the window color to DUST_COLOR.
              vec4 windowColor = texture2D(uTexture, coords + 0.5);
              vec3 dustColor = mix(windowColor.rgb, DUST_COLOR.rgb, DUST_COLOR.a);
              windowColor.rgb = mix(windowColor.rgb, dustColor*windowColor.a, progress);

              // Dissolve the dust particles.
              float dissolve = (dustMap.x - progress) > 0 ? 1 : 0;
              windowColor *= dissolve;

              // Blend the layers.
              cogl_color_out = mix(cogl_color_out, windowColor, windowColor.a);
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
      pipeline.set_layer_filters(0, Cogl.PipelineFilter.LINEAR,
                                 Cogl.PipelineFilter.LINEAR);
      pipeline.set_layer_texture(1, this._dustTexture.get_texture());
      pipeline.set_layer_wrap_mode(1, Cogl.PipelineWrapMode.REPEAT);
      this.set_uniform_value('uDustTexture', 1);
      super.vfunc_paint_target(node, paint_context);
    }
  });
}