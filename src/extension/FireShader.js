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

const {Clutter, GObject} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const shaderSnippets = Me.imports.src.extension.shaderSnippets;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

var FireShader = GObject.registerClass({Properties: {}, Signals: {}},
                                       class FireShader extends Clutter.ShaderEffect {
  _init(settings) {
    super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

    // Load the gradient values from the settings. We directly inject the values in the
    // GLSL code below. The shader is compiled once for each window-closing anyways. In
    // the future, we my want to prevent this frequent recompilations of shaders,
    // though.
    const gradient = [];
    for (let i = 1; i <= 5; i++) {
      const color = Clutter.Color.from_string(settings.get_string('fire-color-' + i))[1];
      gradient.push(`vec4(${color.red / 255}, ${color.green / 255}, ${
          color.blue / 255}, ${color.alpha / 255})`);
    }


    this.set_shader_source(`
      ${shaderSnippets.standardUniforms()}
      ${shaderSnippets.noise()}
      ${shaderSnippets.effectMask()}

      // These may be configurable in the future.
      const float EDGE_FADE  = 70;
      const float FADE_WIDTH = 0.1;
      const float HIDE_TIME  = 0.2;
      const vec2  FIRE_SCALE = vec2(400, 600) * ${settings.get_double('flame-scale')};
      const float FIRE_SPEED = ${settings.get_double('flame-movement-speed')};

      vec4 getFireColor(float v) {
        const float steps[5] = float[](0.0, 0.2, 0.35, 0.5, 0.8);
        const vec4 colors[5] = vec4[](
          ${gradient[0]},
          ${gradient[1]},
          ${gradient[2]},
          ${gradient[3]},
          ${gradient[4]}
        );

        if (v < steps[0]) {
          return colors[0];
        }

        for (int i=0; i<4; ++i) {
          if (v <= steps[i+1]) {
            return mix(colors[i], colors[i+1], vec4(v -
            steps[i])/(steps[i+1]-steps[i]));
          }
        }

        return colors[4];
      }

      void main(void) {

        // Get a noise value.
        vec2 uv = cogl_tex_coord_in[0].st * vec2(uSizeX, uSizeY) / FIRE_SCALE;
        uv.y += uTime * FIRE_SPEED;
        float noise = perlinNoise(uv, 10.0, 5, 0.5);

        // Modulate noise by mask.
        vec2 effectMask = effectMask(HIDE_TIME, FADE_WIDTH, EDGE_FADE);
        noise *= effectMask.y;

        // Map noise value to color.
        vec4 fire = getFireColor(noise);
        fire.rgb *= fire.a;

        // Get window texture.
        cogl_color_out = texture2D(uTexture, cogl_tex_coord_in[0].st) * effectMask.x;

        // Add fire.
        cogl_color_out += fire;
      }
    `);
  };
});