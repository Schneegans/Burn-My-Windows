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
// The Matrix shader multiplies a grid of random letters with some gradients which are  //
// moving from top to bottom. The speed of the moving gradients is chosen randomly.     //
// Also, there is a random delay making the gradients not drop all at the same time.    //
// This effect is not available on GNOME 3.3x, due to the limitation described in the   //
// documentation of vfunc_paint_target further down in this file.                       //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let Shader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var Matrix = class Matrix {

  // ---------------------------------------------------------------------------- metadata

  // This effect is only available on GNOME Shell 40+.
  static getMinShellVersion() {
    return [40, 0];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. the '*-close-effect').
  static getNick() {
    return 'matrix';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return 'Matrix';
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static initPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource('/ui/gtk4/matrixPage.ui');

    // Bind all properties.
    dialog.bindAdjustment('matrix-animation-time');
    dialog.bindAdjustment('matrix-scale');
    dialog.bindAdjustment('matrix-randomness');
    dialog.bindColorButton('matrix-trail-color');
    dialog.bindColorButton('matrix-tip-color');

    // Finally, append the settings page to the main stack.
    const stack = dialog.getBuilder().get_object('main-stack');
    stack.add_titled(
        dialog.getBuilder().get_object('matrix-prefs'), Matrix.getNick(),
        Matrix.getLabel());
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is closed with this effect.
  static createShader(settings) {
    return new Shader(settings);
  }

  // This is also called from extension.js. It is used to tweak the ongoing transitions of
  // the actor - usually windows are faded to transparency and scaled down slightly by
  // GNOME Shell. Here, we modify this behavior as well as the transition duration.
  static tweakTransitions(actor, settings) {
    const animationTime = settings.get_int('matrix-animation-time');

    const tweakTransition = (property, value) => {
      const transition = actor.get_transition(property);
      if (transition) {
        transition.set_to(value);
        transition.set_duration(animationTime);
      }
    };

    // We re-target these transitions so that the window is neither scaled nor faded.
    tweakTransition('opacity', 255);
    tweakTransition('scale-x', 1);
    tweakTransition('scale-y', 1);
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
    _init(settings) {
      super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

      // Load the font texture. As the shader is re-created for each window animation,
      // this texture is also re-created each time. This could be improved in the future!
      const fontData    = GdkPixbuf.Pixbuf.new_from_resource('/img/matrixFont.png');
      this._fontTexture = new Clutter.Image();
      this._fontTexture.set_data(
          fontData.get_pixels(),
          fontData.has_alpha ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
          fontData.width, fontData.height, fontData.rowstride);

      const trailColor =
          Clutter.Color.from_string(settings.get_string('matrix-trail-color'))[1];
      const tipColor =
          Clutter.Color.from_string(settings.get_string('matrix-tip-color'))[1];

      // The technique for this effect was inspired by
      // https://www.shadertoy.com/view/ldccW4, however the implementation is quite
      // different as the letters drop only once and there is no need for a noise texture.
      this.set_shader_source(`

        // Inject some common shader snippets.
        ${shaderSnippets.standardUniforms()}
        ${shaderSnippets.noise()}
        ${shaderSnippets.edgeMask()}

        uniform sampler2D uFontTexture;

        // These may be configurable in the future.
        const float EDGE_FADE             = 30;
        const float FADE_WIDTH            = 150;
        const float TRAIL_LENGTH          = 0.2;
        const float FINAL_FADE_START_TIME = 0.8;
        const float LETTER_TILES          = 16.0;
        const float LETTER_SIZE           = ${settings.get_int('matrix-scale')};
        const float LETTER_FLICKER_SPEED  = 2.0;
        const float RANDOMNESS            = ${settings.get_double('matrix-randomness')};

        // This returns a flickering grid of random letters.
        float getText(vec2 fragCoord) {
          vec2 pixelCoords = fragCoord * vec2(uSizeX, uSizeY);
          vec2 uv = mod(pixelCoords.xy, LETTER_SIZE)/LETTER_SIZE;
          vec2 block = pixelCoords/LETTER_SIZE - uv;

          // Choose random letter.
          uv += floor(hash22(floor(hash22(block)*vec2(12.9898,78.233) + LETTER_FLICKER_SPEED*uTime + 42.254))*LETTER_TILES);

          return texture2D(uFontTexture, uv/LETTER_TILES).r;
        }

        // This returns two values: The first are gradients for the "raindrops" which move
        // from top to bottom. This is used for fading the letters. The second value is set
        // to one below each drop and to zero above it. This second value is used for fading
        // the window texture. 
        vec2 getRain(vec2 fragCoord) {
          vec2 coords = fragCoord * vec2(uSizeX, uSizeY);
          coords.x -= mod(coords.x, LETTER_SIZE);

          float delay = fract(sin(coords.x)*78.233) * mix(0.0, 1.0, RANDOMNESS);
          float speed = fract(cos(coords.x)*12.989) * mix(0.0, 0.3, RANDOMNESS) + 1.5;

          float distToDrop  = (uProgress*2-delay)*speed - fragCoord.y;

          float rainAlpha   = distToDrop >= 0 ? exp(-distToDrop/TRAIL_LENGTH) : 0;
          float windowAlpha = 1 - clamp(uSizeY*distToDrop, 0, FADE_WIDTH) / FADE_WIDTH;

          return vec2(rainAlpha, windowAlpha);
        }

        void main() {

          // Get a cool matrix effect. See comments for those methods above.
          vec2  rain = getRain(cogl_tex_coord_in[0].st);
          float text = getText(cogl_tex_coord_in[0].st);

          // Get the window texture and fade it according to the effect mask.
          cogl_color_out = texture2D(uTexture, cogl_tex_coord_in[0].st) * rain.y;

          // This is used to fade out the remaining trails in the end.
          float finalFade = 1-clamp((uProgress-FINAL_FADE_START_TIME)/
                                    (1-FINAL_FADE_START_TIME), 0, 1);
          float rainAlpha = finalFade * rain.x;

          // Fade at window borders.
          rainAlpha *= getAbsoluteEdgeMask(EDGE_FADE);

          // Add the matrix effect to the window.
          vec3 trailColor = vec3(${trailColor.red / 255}, 
                                 ${trailColor.green / 255}, 
                                 ${trailColor.blue / 255});
          vec3 tipColor =   vec3(${tipColor.red / 255}, 
                                 ${tipColor.green / 255}, 
                                 ${tipColor.blue / 255});
          cogl_color_out.rgb += mix(trailColor, tipColor, min(1, pow(rainAlpha+0.1, 4))) * rainAlpha * text;

          // These are pretty useful for understanding how this works.
          // cogl_color_out = vec4(vec3(text), 1);
          // cogl_color_out = vec4(vec3(rain.x), 1);
          // cogl_color_out = vec4(vec3(rain.y), 1);
        }
      `);
    };

    // This is overridden to bind the font texture for drawing. Sadly, this seems to be
    // impossible under GNOME 3.3x as this.get_pipeline() is not available. It was called
    // get_target() back then but this is not wrapped in GJS.
    // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
    vfunc_paint_target(node, paint_context) {
      const pipeline = this.get_pipeline();
      pipeline.set_layer_texture(1, this._fontTexture.get_texture());
      this.set_uniform_value('uFontTexture', 1);
      super.vfunc_paint_target(node, paint_context);
    }
  });
}