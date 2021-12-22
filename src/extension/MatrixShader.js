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

    const fontData    = GdkPixbuf.Pixbuf.new_from_resource('/img/matrixFont.png');
    this._fontTexture = new Clutter.Image();
    this._fontTexture.set_data(
        fontData.get_pixels(),
        fontData.has_alpha ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
        fontData.width, fontData.height, fontData.rowstride);

    // This is roughly based on https://www.shadertoy.com/view/ldccW4 (CC-BY-NC-SA).
    this.set_shader_source(`

      // Inject some common shader snippets.
      ${shaderSnippets.standardUniforms()}
      ${shaderSnippets.noise()}

      uniform sampler2D uFontTexture;

      // These may be configurable in the future.
      const float EDGE_FADE  = 30;
      const float FADE_WIDTH = 50;
      const float TRAIL_LENGTH  = 0.2;
      const float FINAL_FADE_START_TIME  = 0.8;
      const float LETTER_TILES  = 16.0;
      const float LETTER_SIZE  = 16.0;
      const float BRIGHTNESS_BOOST  = 2;
      const float RANDOMNESS  = 1.0;

      float getText(vec2 fragCoord) {
        vec2 coords = fragCoord * vec2(uSizeX, uSizeY);
        vec2 uv = mod(coords.xy, LETTER_SIZE)/LETTER_SIZE;
        vec2 block = coords/LETTER_SIZE - uv;

        // scale the letters up a bit
        uv = uv*.8+.1;
        
        // bring back into 0-1 range 
        uv += floor(rand2(block/512 + uTime*.0000001)*LETTER_TILES);
        uv /= LETTER_TILES; 
        
        // flip letters horizontally
        uv.x = -uv.x+1.0;
        return texture2D(uFontTexture, uv).r;
      }

      vec2 getRain(vec2 fragCoord) {
        vec2 coords = fragCoord * vec2(uSizeX, uSizeY);
        coords.x -= mod(coords.x, LETTER_SIZE);

        float delay = abs(sin(coords.x * 3.0)) * mix(0.0, 1.0, RANDOMNESS);
        float speed  = cos(coords.x * 7.0) * mix(0.0, 0.3, RANDOMNESS) + 1.5;

        float distToDrop = (uProgress*2-delay)*speed - fragCoord.y;
        return vec2(distToDrop >= 0 ? exp(-distToDrop/TRAIL_LENGTH) : 0,
                    clamp(uSizeY*distToDrop, 0, FADE_WIDTH) / FADE_WIDTH);
      }

      void main() {

        vec3 color = vec3(0.1,1,0.35);

        // Get a cool matrix effect.
        vec2  rain = getRain(cogl_tex_coord_in[0].st);
        float text = getText(cogl_tex_coord_in[0].st);

        // Get the window texture and fade it according to the effect mask.
        float windowAlpha = 1 - rain.y;
        cogl_color_out = texture2D(uTexture, cogl_tex_coord_in[0].st) * windowAlpha;

        float finalFade = 1-clamp((uProgress-FINAL_FADE_START_TIME)/(1-FINAL_FADE_START_TIME), 0, 1);
        float textAlpha = finalFade * rain.x * BRIGHTNESS_BOOST;


        // Fade at window borders.
        vec2 pos = cogl_tex_coord_in[0].st * vec2(uSizeX, uSizeY);
        textAlpha *= clamp(pos.x / EDGE_FADE, 0, 1);
        textAlpha *= clamp(pos.y / EDGE_FADE, 0, 1);
        textAlpha *= clamp((uSizeX - pos.x) / EDGE_FADE, 0, 1);
        textAlpha *= clamp((uSizeY - pos.y) / EDGE_FADE, 0, 1);

        // Add the fire to the window.
        cogl_color_out.rgb += color * textAlpha * text;
      }
    `);
  };

  vfunc_paint_target(node, paint_context) {
    const pipeline = this.get_pipeline();
    pipeline.set_layer_texture(1, this._fontTexture.get_texture());
    this.set_uniform_value('uFontTexture', 1);
    super.vfunc_paint_target(node, paint_context);
  }
});