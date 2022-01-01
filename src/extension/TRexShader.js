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

var TRexShader = GObject.registerClass({Properties: {}, Signals: {}},
                                       class TRexShader extends Clutter.ShaderEffect {
  _init(settings) {
    super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

    // Load the font texture. As the shader is re-created for each window animation, this
    // texture is also re-created each time. This could be improved in the future!
    const clawData    = GdkPixbuf.Pixbuf.new_from_resource('/img/claws.png');
    this._clawTexture = new Clutter.Image();
    this._clawTexture.set_data(
        clawData.get_pixels(), Cogl.PixelFormat.RGB_888, clawData.width, clawData.height,
        clawData.rowstride);

    const color = Clutter.Color.from_string(settings.get_string('claw-scratch-color'))[1];

    // This is partially based on https://www.shadertoy.com/view/ldccW4 (CC-BY-NC-SA).
    this.set_shader_source(`

      // Inject some common shader snippets.
      ${shaderSnippets.standardUniforms()}
      ${shaderSnippets.noise()}

      uniform sampler2D uClawTexture;

      const vec2 SEED = vec2(${Math.random()}, ${Math.random()});

      vec2 getClawUV(vec2 texCoords, float globalScale, vec2 seed) {

        vec2 coords = texCoords + rand2(seed);
        coords *= uSizeX < uSizeY ? vec2(1.0, 1.0 * uSizeY / uSizeX) : vec2(1.0 * uSizeX / uSizeY, 1.0);
        
        coords *= globalScale;

        vec2 uv = mod(coords, vec2(1));
        vec2 block = coords-uv + vec2(362.456);

        float scale    = mix(0.8, 1.0,         rand(block*seed*134.451));
        float offsetX  = mix(0.0, 1.0 - scale, rand(block*seed*54.4129));
        float offsetY  = mix(0.0, 1.0 - scale, rand(block*seed*25.3089));
        float rotation = mix(0.0, 2.0 * 3.141, rand(block*seed*2.99837));
        
        uv -= vec2(offsetX, offsetY);
        uv /= scale;

        uv -= 0.5;
        uv = vec2(uv.x * cos(rotation) - uv.y * sin(rotation),
                  uv.x * sin(rotation) + uv.y * cos(rotation));
        uv += 0.5;

        return clamp(uv, vec2(0), vec2(1));
      }

      void main() {

        const float CLAW_SIZE       = ${settings.get_double('claw-scratch-scale')};
        const float NUM_CLAWS       = ${settings.get_int('claw-scratch-count')};
        const float WARP_INTENSITY  = 1.0 + ${settings.get_double('claw-scratch-warp')};
        const float FLASH_INTENSITY = 0.1;
        const float MAX_SPAWN_TIME  = 0.5;
        const float FF_TIME         = 0.5;  // Relative time for the final fade to transparency.

        float fade = smoothstep(0, 1, 1 - clamp((uProgress - 1.0 + FF_TIME)/FF_TIME, 0, 1));

        float mask = 1.0;

        vec2 coords = cogl_tex_coord_in[0].st * 2.0 - 1.0;
        float dist = length(coords);

        coords = (coords/dist * pow(dist, WARP_INTENSITY)) * 0.5 + 0.5;

        coords = mix(cogl_tex_coord_in[0].st, coords, uProgress);

        for (int i=0; i<NUM_CLAWS; ++i) {
          vec2 uv = getClawUV(coords, 1.0/CLAW_SIZE, SEED*(i+1));
          float delay = i/NUM_CLAWS * MAX_SPAWN_TIME;
          mask = min(mask, clamp(texture2D(uClawTexture, uv).r + delay, 0, 1));
        }



        // Get the window texture.
        vec2 dir = vec2(dFdx(mask), dFdy(mask))*uProgress*mask*0.5;
        cogl_color_out = texture2D(uTexture, coords + dir);

        float flash = 1.0 / FLASH_INTENSITY * (mask - uProgress) + 1;
        if (flash < 0 || flash >= 1) {
          flash = 0;
        }

        vec3 flashColor = vec3(${color.red / 255}, 
                               ${color.green / 255}, 
                               ${color.blue / 255}) * ${color.alpha / 255};

        cogl_color_out *= (mask > uProgress ? 1 : 0);
        cogl_color_out.rgb += flash * mix(flashColor, vec3(0), uProgress);

        

        cogl_color_out *= fade;

        // cogl_color_out = vec4(vec3(flash), 1);
        // cogl_color_out = vec4(vec3(mask), 1);

      }
    `);
  };

  // This is overridden to bind the claw texture for drawing. Sadly, this seems to be
  // impossible under GNOME 3.3x as this.get_pipeline() is not available. It was called
  // get_target() back then but this is not wrapped in GJS.
  // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
  vfunc_paint_target(node, paint_context) {
    const pipeline = this.get_pipeline();
    pipeline.set_layer_texture(1, this._clawTexture.get_texture());
    this.set_uniform_value('uClawTexture', 1);
    super.vfunc_paint_target(node, paint_context);
  }
});