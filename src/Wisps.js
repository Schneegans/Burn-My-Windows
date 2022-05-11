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
// This effect lets your windows be carried to the realm of dreams by some little       //
// fairies. It's implemented with several overlaid grids of randomly moving points.     //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file. When this
// effect is used for the first time, an instance of this shader class is created. Once
// the effect is finished, the shader will be stored in the freeShaders array and will
// then be reused if a new shader is requested. ShaderClass which will be used whenever
// this effect is used.
let ShaderClass = null;
let freeShaders = [];

// This will be called in various places where a unique identifier for this effect is
// required. It should match the prefix of the settings keys which store whether the
// effect is enabled currently (e.g. '*-close-effect'), and its animation time
// (e.g. '*-animation-time').
var Wisps = class Wisps {

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
    return _('Wisps');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource(`/ui/${utils.getGTKString()}/Wisps.ui`);

    // Bind all properties.
    dialog.bindAdjustment('wisps-animation-time');
    dialog.bindAdjustment('wisps-scale');
    dialog.bindColorButton('wisps-color');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('wisps-prefs');
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is opened or closed with this
  // effect. It returns an instance of the shader class, trying to reuse previously
  // created shaders.
  static getShader(actor, settings, forOpening) {
    let shader;

    if (freeShaders.length == 0) {
      shader = new ShaderClass();
    } else {
      shader = freeShaders.pop();
    }

    shader.setUniforms(actor, settings, forOpening);

    return shader;
  }

  // The tweakTransition() is called from extension.js to tweak a window's open / close
  // transitions - usually windows are faded in / out and scaled up / down by GNOME Shell.
  // The parameter 'forOpening' is set to true if this is called for a window-open
  // transition, for a window-close transition it is set to false. The modes can be set to
  // any value from here: https://gjs-docs.gnome.org/clutter8~8_api/clutter.animationmode.
  // The only required property is 'opacity', even if it transitions from 1.0 to 1.0. The
  // current value of the opacity transition is passed as uProgress to the shader.
  // Tweaking the actor's scale during the transition only works properly for GNOME 3.38+.

  // For this effect, windows should be scaled down slightly but not faded.
  static tweakTransition(actor, settings, forOpening) {
    return {
      'opacity': {from: 255, to: 255, mode: 3},
      'scale-x': {from: forOpening ? 0.9 : 1.0, to: forOpening ? 1.0 : 0.9, mode: 3},
      'scale-y': {from: forOpening ? 0.9 : 1.0, to: forOpening ? 1.0 : 0.9, mode: 3}
    };
  }

  // This is called from extension.js if the extension is disabled. This should free all
  // static resources.
  static cleanUp() {
    freeShaders = [];
  }
}


//////////////////////////////////////////////////////////////////////////////////////////
// The shader class for this effect will only be registered in GNOME Shell's process    //
// (not in the preferences process). It's done this way as Clutter may not be installed //
// on the system and therefore the preferences would crash.                             //
//////////////////////////////////////////////////////////////////////////////////////////

if (utils.isInShellProcess()) {

  const {Clutter, Shell} = imports.gi;
  const shaderSnippets   = Me.imports.src.shaderSnippets;

  ShaderClass = GObject.registerClass({}, class ShaderClass extends Shell.GLSLEffect {
    // This is called when the effect is used for the first time. This can be used to
    // store all required uniform locations.
    _init() {
      super._init();

      this._uSeed  = this.get_uniform_location('uSeed');
      this._uColor = this.get_uniform_location('uColor');
      this._uScale = this.get_uniform_location('uScale');
    }

    // This is called each time the effect is used. This can be used to retrieve the
    // configuration from the settings and update all uniforms accordingly.
    setUniforms(actor, settings, forOpening) {
      const c = Clutter.Color.from_string(settings.get_string('wisps-color'))[1];

      // If we are currently performing integration test, the animation uses a fixed seed.
      const testMode = settings.get_boolean('test-mode');

      // clang-format off
      this.set_uniform_float(this._uSeed,  2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
      this.set_uniform_float(this._uColor, 3, [c.red / 255, c.green / 255, c.blue / 255]);
      this.set_uniform_float(this._uScale, 1, [settings.get_double('wisps-scale')]);
      // clang-format on
    }

    // This is called by extension.js when the shader is not used anymore. We will store
    // this instance of the shader so that it can be re-used in th future.
    free() {
      freeShaders.push(this);
    }

    // This is called by the constructor. This means, it's only called when the effect
    // is used for the first time.
    vfunc_build_pipeline() {
      const declarations = `
        // Inject some common shader snippets.
        ${shaderSnippets.standardUniforms()}
        ${shaderSnippets.noise()}
        ${shaderSnippets.edgeMask()}
        ${shaderSnippets.compositing()}

        uniform vec2  uSeed;
        uniform vec3  uColor;
        uniform float uScale;

        const float WISPS_RADIUS    = 20.0;
        const float WISPS_SPEED     = 10.0;
        const float WISPS_SPACING   = 40 + WISPS_RADIUS;
        const int   WISPS_LAYERS    = 8;
        const float WISPS_IN_TIME   = 0.5;
        const float WINDOW_OUT_TIME = 1.0;

        // Returns a grid of randomly moving points. Each grid cell contains one point which
        // moves on an ellipse. 
        float getWisps(vec2 texCoords, float gridSize, vec2 seed) {

          // Shift coordinates by a random offset and make sure the have a 1:1 aspect ratio.
          vec2 coords = (texCoords + hash22(seed)) * uSize;

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
          offset *= 0.5 - 0.5 * radius / gridSize;
          offset = vec2(offset.x * cos(rotation) - offset.y * sin(rotation),
                        offset.x * sin(rotation) + offset.y * cos(rotation));

          cellUV += offset;

          // Use distance to center of shifted / rotated UV coordinates to draw a glaring point.
          float dist = length(cellUV - 0.5) * gridSize / radius;
          if (dist < 1.0) {
            return min(5, 0.01 / pow(dist, 2.0));
          }

          return 0.0;
        }
      `;

      const code = `
        float progress = uForOpening ? 1.0-uProgress : uProgress;
        
        // Get the color of the window.
        cogl_color_out = texture2D(uTexture, cogl_tex_coord_in[0].st);
        
        // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
        if (cogl_color_out.a > 0) {
          cogl_color_out.rgb /= cogl_color_out.a;
        }
        
        // Compute several layers of moving wisps.
        vec2 uv = (cogl_tex_coord_in[0].st-0.5) / mix(1.0, 0.5, progress) + 0.5;
        uv /= uScale;
        float wisps = 0;
        for (int i=0; i<WISPS_LAYERS; ++i) {
          wisps += getWisps(uv*0.3, WISPS_SPACING, uSeed * (i+1));
        }

        // Compute shrinking edge mask.
        float mask = getRelativeEdgeMask(mix(0.01, 0.5, progress));

        // Compute three different progress values.
        float wispsIn   = smoothstep(0, 1, clamp(progress/WISPS_IN_TIME, 0, 1));
        float wispsOut  = smoothstep(0, 1, clamp((progress - WISPS_IN_TIME)/(1.0 - WISPS_IN_TIME), 0, 1));
        float windowOut = smoothstep(0, 1, clamp(progress/WINDOW_OUT_TIME, 0, 1));

        // Use a noise function to dissolve the window.
        float noise = smoothstep(1.0, 0.0, abs(2.0 * simplex2DFractal(uv * uSize / 250) - 1.0));
        float windowMask = 1.0 - (windowOut < 0.5 ? mix(0.0, noise, windowOut * 2.0) : mix(noise, 1.0, windowOut * 2.0 - 1.0));
        cogl_color_out.a *= windowMask * mask;

        // Add the wisps.
        vec4 wispColor = wisps * vec4(uColor, min(wispsIn, 1.0 - wispsOut)*mask);
        cogl_color_out = alphaOver(cogl_color_out, wispColor);

        // These are pretty useful for understanding how this works.
        // cogl_color_out = vec4(vec3(windowMask), 1.0);
        // cogl_color_out = vec4(vec3(wisps), 1.0);
        // cogl_color_out = vec4(vec3(noise), 1.0);
        // cogl_color_out = vec4(vec3(mask*min(wispsIn, 1.0 - wispsOut)), 1.0);
      `;

      this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, declarations, code, true);
    }
  });
}