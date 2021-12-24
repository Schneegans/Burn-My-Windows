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

const {Clutter, GObject, GdkPixbuf, Cogl} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const shaderSnippets = Me.imports.src.extension.shaderSnippets;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

var MatrixShader = GObject.registerClass({Properties: {}, Signals: {}},
                                         class MatrixShader extends Clutter.ShaderEffect {
  _init(settings) {
    super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

    // Load the font texture. As the shader is re-created for each window animation, this
    // texture is also re-created each time. This could be improved in the future!
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

    // This is partially based on https://www.shadertoy.com/view/ldccW4 (CC-BY-NC-SA).
    this.set_shader_source(`

      // Inject some common shader snippets.
      ${shaderSnippets.standardUniforms()}
      ${shaderSnippets.noise()}

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
        uv += floor(rand2(floor(rand(block)*vec2(12.9898,78.233) + LETTER_FLICKER_SPEED*uTime + 42.254))*LETTER_TILES);
        
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
        vec2 pos = cogl_tex_coord_in[0].st * vec2(uSizeX, uSizeY);
        rainAlpha *= clamp(pos.x / EDGE_FADE, 0, 1);
        rainAlpha *= clamp(pos.y / EDGE_FADE, 0, 1);
        rainAlpha *= clamp((uSizeX - pos.x) / EDGE_FADE, 0, 1);
        rainAlpha *= clamp((uSizeY - pos.y) / EDGE_FADE, 0, 1);

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

  // This is overridden to bind the font texture for drawing.
  vfunc_paint_target(node, paint_context) {
    const pipeline = this.get_pipeline();
    pipeline.set_layer_texture(1, this._fontTexture.get_texture());
    this.set_uniform_value('uFontTexture', 1);
    super.vfunc_paint_target(node, paint_context);
  }
});