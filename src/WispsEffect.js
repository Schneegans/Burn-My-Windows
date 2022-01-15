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
// This effect lets your windows be carried to the realm of dreams by some little       //
// fairies. It's implemented with several overlaid grids of randomly moving points.     //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let Shader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var WispsEffect = class WispsEffect {

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. the '*-close-effect').
  static getNick() {
    return 'wisps';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return 'Wisps';
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static initPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource(`/ui/${utils.getGTKString()}/wispsPage.ui`);

    // Bind all properties.
    dialog.bindAdjustment('wisps-animation-time');
    dialog.bindColorButton('wisps-color');

    // Finally, append the settings page to the main stack.
    const stack = dialog.getBuilder().get_object('main-stack');
    stack.add_titled(
        dialog.getBuilder().get_object('wisps-prefs'), WispsEffect.getNick(),
        WispsEffect.getLabel());
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
    const animationTime = settings.get_int('wisps-animation-time');

    const tweakTransition = (property, value) => {
      const transition = actor.get_transition(property);
      if (transition) {
        transition.set_to(value);
        transition.set_duration(animationTime);
      }
    };

    // We re-target these transitions so that the window is not faded but scaled down a
    // tiny bit.
    tweakTransition('opacity', 255);
    tweakTransition('scale-x', 0.9);
    tweakTransition('scale-y', 0.9);
  }
}


//////////////////////////////////////////////////////////////////////////////////////////
// The shader class for this effect will only be registered in GNOME Shell's process    //
// (not in the preferences process). It's done this way as Clutter may not be installed //
// on the system and therefore the preferences would crash.                             //
//////////////////////////////////////////////////////////////////////////////////////////

if (utils.isInShellProcess()) {

  const Clutter        = imports.gi.Clutter;
  const shaderSnippets = Me.imports.src.shaderSnippets;

  Shader = GObject.registerClass({}, class Shader extends Clutter.ShaderEffect {
    _init(settings) {
      super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

      const color = Clutter.Color.from_string(settings.get_string('wisps-color'))[1];

      this.set_shader_source(`

      // Inject some common shader snippets.
      ${shaderSnippets.standardUniforms()}
      ${shaderSnippets.noise()}

      const vec2  SEED            = vec2(${Math.random()}, ${Math.random()});
      const float WISPS_RADIUS    = 20.0;
      const float WISPS_SPEED     = 15.0;
      const float WISPS_SPACING   = 50 + WISPS_RADIUS;
      const int   WISPS_LAYERS    = 15;
      const float WISPS_IN_TIME   = 0.5;
      const float WINDOW_OUT_TIME = 1.0;

      // Returns a grid of randomly moving points. Each grid cell contains one point which
      // moves on an ellipse. 
      float getWisps(vec2 texCoords, float gridSize, vec2 seed) {

        // Shift coordinates by a random offset and make sure the have a 1:1 aspect ratio.
        vec2 coords = (texCoords + hash22(seed)) * vec2(uSizeX, uSizeY);

        // Apply global scale.
        coords /= gridSize;

        // Get grid cell coordinates in [0..1].
        vec2 cellUV = mod(coords, vec2(1));

        // This is unique for each cell.
        vec2 cellID = coords-cellUV + vec2(362.456);

        // Add random rotation, scale and offset to each grid cell.
        float speed     = mix(10.0, 15.0,   hash12(cellID*seed*134.451)) / gridSize * WISPS_SPEED;
        float rotation  = mix( 0.0,  6.283, hash12(cellID*seed*54.4129));
        float radius    = mix( 0.5,  1.0,   hash12(cellID*seed*19.1249)) * WISPS_RADIUS;
        float roundness = mix(-1.0,  1.0,   hash12(cellID*seed*7.51949));

        vec2 offset = vec2(sin(speed * (uTime+1)) * roundness, cos(speed * (uTime+1)));
        offset *= (0.5 - radius / gridSize);
        offset = vec2(offset.x * cos(rotation) - offset.y * sin(rotation),
                      offset.x * sin(rotation) + offset.y * cos(rotation));

        cellUV += offset;

        // Use distance to center of shifted / rotated UV coordinates to draw a glaring point.
        float dist = length(cellUV - 0.5) * gridSize / radius;
        if (dist < 1.0) {
          return min(10, 0.01 / pow(dist, 2.0));
        }

        return 0.0;
      }

      void main() {
        
        // Get the color of the window.
        vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);
        vec4 effectColor = vec4(${color.red / 255},
          ${color.green / 255},
          ${color.blue / 255}, 1.0) * windowColor.a;
        
        // Compute several layers of moving wisps.
        vec2 uv = (cogl_tex_coord_in[0].st-0.5) / mix(1.0, 0.5, uProgress) + 0.5;
        float wisps = 0;
        for (int i=0; i<WISPS_LAYERS; ++i) {
          wisps += getWisps(uv*0.3, WISPS_SPACING, SEED * (i+1));
        }

        // Compute shrinking edge mask.
        float edgeFadeWidth = mix(0.01, 0.5, uProgress);
        float mask          = 1.0;
        mask *= smoothstep(0.0, 1.0,        cogl_tex_coord_in[0].x  / edgeFadeWidth);
        mask *= smoothstep(0.0, 1.0,        cogl_tex_coord_in[0].y  / edgeFadeWidth);
        mask *= smoothstep(0.0, 1.0, (1.0 - cogl_tex_coord_in[0].x) / edgeFadeWidth);
        mask *= smoothstep(0.0, 1.0, (1.0 - cogl_tex_coord_in[0].y) / edgeFadeWidth);

        // Compute three different progress values.
        float wispsIn   = smoothstep(0, 1, clamp(uProgress/WISPS_IN_TIME, 0, 1));
        float wispsOut  = smoothstep(0, 1, clamp((uProgress - WISPS_IN_TIME)/(1.0 - WISPS_IN_TIME), 0, 1));
        float windowOut = smoothstep(0, 1, clamp(uProgress/WINDOW_OUT_TIME, 0, 1));

        // Use a noise function to dissolve the window.
        float noise = smoothstep(1.0, 0.0, abs(2.0 * simplex3DFractal(vec3(uv * vec2(uSizeX, uSizeY) / 250, uTime * 0.5)) - 1.0));
        float windowMask = 1.0 - (windowOut < 0.5 ? mix(0.0, noise, windowOut * 2.0) : mix(noise, 1.0, windowOut * 2.0 - 1.0));
        cogl_color_out = windowColor * windowMask * mask;

        // Add the wisps.
        cogl_color_out += min(wispsIn, 1.0 - wispsOut) * wisps * effectColor * mask;

        // These are pretty useful for understanding how this works.
        // cogl_color_out = vec4(vec3(windowMask), 1.0);
        // cogl_color_out = vec4(vec3(wisps), 1.0);
        // cogl_color_out = vec4(vec3(noise), 1.0);
        // cogl_color_out = vec4(vec3(mask*min(wispsIn, 1.0 - wispsOut)), 1.0);
      }
      `);
    };
  });
}