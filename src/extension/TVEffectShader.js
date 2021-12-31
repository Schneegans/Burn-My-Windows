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
// The TVEffectShader hides the actor by making it first transparent from top and       //
// bottom towards the middle and then hiding the resulting line from left and right     //
// towards the center.                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////

var TVEffectShader = GObject.registerClass(
    {Properties: {}, Signals: {}}, class TVEffectShader extends Clutter.ShaderEffect {
      _init(settings) {
        super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

        this.set_shader_source(`

        // Inject some common shader snippets.
        ${shaderSnippets.standardUniforms()}

        const float BLUR_WIDTH = 0.01; // Width of the gradients.
        const float TB_TIME    = 0.7;  // Relative time for the top/bottom animation.
        const float LR_TIME    = 0.4;  // Relative time for the left/right animation.
        const float LR_DELAY   = 0.6;  // Delay after which the left/right animation starts.
        const float FF_TIME    = 0.2;  // Relative time for the final fade to transparency.

        void main() {

          // All of these are in [0..1] during the different stages of the animation.
          // tb refers to the top-bottom animation.
          // lr refers to the left-right animation.
          // ff refers to the final fade animation.
          float tbProgress = smoothstep(0, 1, clamp(uProgress/TB_TIME, 0, 1));
          float lrProgress = smoothstep(0, 1, clamp((uProgress - LR_DELAY)/LR_TIME, 0, 1));
          float ffProgress = smoothstep(0, 1, clamp((uProgress - 1.0 + FF_TIME)/FF_TIME, 0, 1));

          // This is a top-center-bottom gradient in [0..1..0]
          float tb = cogl_tex_coord_in[0].t * 2;
          tb = tb < 1 ? tb : 2 - tb;
          
          // This is a left-center-right gradient in [0..1..0]
          float lr = cogl_tex_coord_in[0].s * 2;
          lr = lr < 1 ? lr : 2 - lr;
          
          // Combine the progress values with the gradients to create the alpha masks.
          float tbMask = 1 - smoothstep(0, 1, clamp((tbProgress - tb) / BLUR_WIDTH, 0, 1));
          float lrMask = 1 - smoothstep(0, 1, clamp((lrProgress - lr) / BLUR_WIDTH, 0, 1));
          float ffMask = 1 - smoothstep(0, 1, ffProgress);

          // Assemble the final alpha value.
          float mask = tbMask * lrMask * ffMask;

          vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);
          vec4 effectColor = vec4(1, 1, 1, 1) * windowColor.a;

          windowColor.rgb = mix(windowColor.rgb, effectColor.rgb, smoothstep(0, 1, uProgress));

          cogl_color_out = windowColor * mask;

          // These are pretty useful for understanding how this works.
          // cogl_color_out = vec4(vec3(tbMask), 1);
          // cogl_color_out = vec4(vec3(lrMask), 1);
          // cogl_color_out = vec4(vec3(ffMask), 1);
          // cogl_color_out = vec4(vec3(mask), 1);
        }
        `);
      };
    });