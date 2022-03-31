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
// This effect tears your windows apart with a series of violent scratches!             //
// This effect is not available on GNOME 3.3x, due to the limitation described in the   //
// documentation of vfunc_paint_target further down in this file.                       //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let Shader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var TRexAttack = class TRexAttack {

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
    return 'trex';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('T-Rex Attack');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource('/ui/gtk4/TRexAttack.ui');

    // Bind all properties.
    dialog.bindAdjustment('trex-animation-time');
    dialog.bindColorButton('claw-scratch-color');
    dialog.bindAdjustment('claw-scratch-scale');
    dialog.bindAdjustment('claw-scratch-count');
    dialog.bindAdjustment('claw-scratch-warp');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('trex-prefs');
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is closed with this effect.
  static createShader(actor, settings, forOpening) {
    return new Shader(settings, forOpening);
  }

  // The tweakTransition() is called from extension.js to tweak a window's open / close
  // transitions - usually windows are faded in / out and scaled up / down by GNOME Shell.
  // The parameter 'forOpening' is set to true if this is called for a window-open
  // transition, for a window-close transition it is set to false. The modes can be set to
  // any value from here: https://gjs-docs.gnome.org/clutter8~8_api/clutter.animationmode.
  // The only required property is 'opacity', even if it transitions from 1.0 to 1.0. The
  // current value of the opacity transition is passed as uProgress to the shader.
  // Tweaking the actor's scale during the transition only works properly for GNOME 3.38+.

  // For this effect, we slightly increase the window's scale as part of the warp effect.
  static tweakTransition(actor, settings, forOpening) {
    const warp = 1.0 + 0.5 * settings.get_double('claw-scratch-warp');
    return {
      'opacity': {from: 255, to: 255, mode: 3},
      'scale-x': {from: forOpening ? warp : 1.0, to: forOpening ? 1.0 : warp, mode: 3},
      'scale-y': {from: forOpening ? warp : 1.0, to: forOpening ? 1.0 : warp, mode: 3}
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
    _init(settings, forOpening) {
      super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

      // Load the claw texture. As the shader is re-created for each window animation,
      // this texture is also re-created each time. This could be improved in the future!
      // See assets/README.md for how this texture was created.
      const clawData    = GdkPixbuf.Pixbuf.new_from_resource('/img/claws.png');
      this._clawTexture = new Clutter.Image();
      this._clawTexture.set_data(clawData.get_pixels(), Cogl.PixelFormat.RGB_888,
                                 clawData.width, clawData.height, clawData.rowstride);

      const color =
        Clutter.Color.from_string(settings.get_string('claw-scratch-color'))[1];

      // If we are currently performing integration test, the animation uses a fixed seed.
      const testMode = settings.get_boolean('test-mode');

      this.set_shader_source(`

        // Inject some common shader snippets.
        ${shaderSnippets.standardUniforms()}
        ${shaderSnippets.noise()}

        // See assets/README.md for how this texture was created.
        uniform sampler2D uClawTexture;

        const vec2  SEED            = vec2(${testMode ? 0 : Math.random()}, 
                                           ${testMode ? 0 : Math.random()});
        const float CLAW_SIZE       = ${settings.get_double('claw-scratch-scale')};
        const float NUM_CLAWS       = ${settings.get_int('claw-scratch-count')};
        const float WARP_INTENSITY  = 1.0 + ${settings.get_double('claw-scratch-warp')};
        const float FLASH_INTENSITY = 0.1;
        const float MAX_SPAWN_TIME  = 0.6; // Scratches will only start in the first half of the animation.
        const float FF_TIME         = 0.6; // Relative time for the final fade to transparency.

        // This method generates a grid of randomly rotated, slightly shifted and scaled 
        // UV squares. It returns the texture coords of the UV square at the given actor
        // coordinates. If these do not fall into one of the UV grids, the coordinates of
        // the closest UV grid will be clamped and returned.
        vec2 getClawUV(vec2 texCoords, float gridScale, vec2 seed) {

          // Shift coordinates by a random offset and make sure the have a 1:1 aspect ratio.
          vec2 coords = texCoords + hash22(seed);
          coords *= uSizeX < uSizeY ? vec2(1.0, 1.0 * uSizeY / uSizeX) : vec2(1.0 * uSizeX / uSizeY, 1.0);

          // Apply global scale.
          coords *= gridScale;

          // Get grid cell coordinates in [0..1].
          vec2 cellUV = mod(coords, vec2(1));

          // This is unique for each cell.
          vec2 cellID = coords-cellUV + vec2(362.456);

          // Add random rotation, scale and offset to each grid cell.
          float scale    = mix(0.8, 1.0,         hash12(cellID*seed*134.451));
          float offsetX  = mix(0.0, 1.0 - scale, hash12(cellID*seed*54.4129));
          float offsetY  = mix(0.0, 1.0 - scale, hash12(cellID*seed*25.3089));
          float rotation = mix(0.0, 2.0 * 3.141, hash12(cellID*seed*2.99837));

          cellUV -= vec2(offsetX, offsetY);
          cellUV /= scale;

          cellUV -= 0.5;
          cellUV = vec2(cellUV.x * cos(rotation) - cellUV.y * sin(rotation),
                        cellUV.x * sin(rotation) + cellUV.y * cos(rotation));
          cellUV += 0.5;

          // Clamp resulting coordinates.
          return clamp(cellUV, vec2(0), vec2(1));
        }

        void main() {

          float progress = ${forOpening ? '1.0-uProgress' : 'uProgress'};

          // Warp the texture coordinates to create a blow-up effect.
          vec2  coords = cogl_tex_coord_in[0].st * 2.0 - 1.0;
          float dist   = length(coords);
          coords = (coords/dist * pow(dist, WARP_INTENSITY)) * 0.5 + 0.5;
          coords = mix(cogl_tex_coord_in[0].st, coords, progress);

          // Accumulate several random scratches. The color in the scratch map refers to the
          // relative time when the respective part will become invisible. Therefore we can
          // add a value to make the scratch appear later.
          float scratchMap = 1.0;
          for (int i=0; i<NUM_CLAWS; ++i) {
            vec2  uv    = getClawUV(coords, 1.0/CLAW_SIZE, SEED*(i+1));
            float delay = i/NUM_CLAWS * MAX_SPAWN_TIME;
            scratchMap  = min(scratchMap, clamp(texture2D(uClawTexture, uv).r + delay, 0, 1));
          }

          // Get the window texture. We shift the texture lookup by the local derivative of
          // the claw texture in order to mimic some folding distortion.
          vec2 offset = vec2(dFdx(scratchMap), dFdy(scratchMap)) * progress * 0.5;
          cogl_color_out = texture2D(uTexture, coords + offset);

          // Add colorful flashes.
          float flashIntensity = 1.0 / FLASH_INTENSITY * (scratchMap - progress) + 1;
          if (flashIntensity < 0 || flashIntensity >= 1) {
            flashIntensity = 0;
          }

          // Hide flashes where there is now window.
          flashIntensity *= cogl_color_out.a;

          // Hide scratched out parts.
          cogl_color_out *= (scratchMap > progress ? 1 : 0);

          vec3 flashColor = vec3(${color.red / 255},
          ${color.green / 255},
          ${color.blue / 255}) * ${color.alpha / 255};

          cogl_color_out.rgb += flashIntensity * mix(flashColor, vec3(0), progress);

          // Fade out the remaining shards.
          float fadeProgress = smoothstep(0, 1, (progress - 1.0 + FF_TIME)/FF_TIME);
          cogl_color_out *= sqrt(1-fadeProgress*fadeProgress);

          // These are pretty useful for understanding how this works.
          // cogl_color_out = vec4(vec3(flashIntensity), 1);
          // cogl_color_out = vec4(vec3(scratchMap), 1);
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
}