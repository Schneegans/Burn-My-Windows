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
// This effect overlays a glowing hexagonal grid over the window. The grid cells then   //
// gradually shrink until the window is fully dissolved.                                //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file. When this
// effect is used for the first time, an instance of this shader class is created. Once
// the effect is finished, the shader will be stored in the freeShaders array and will
// then be reused if a new shader is requested. ShaderClass which will be used whenever
// this effect is used.
let ShaderClass = null;
let freeShaders = [];

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var Hexagon = class Hexagon {

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-close-effect'), and its animation time
  // (e.g. '*-animation-time').
  static getNick() {
    return 'hexagon';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Hexagon');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource(`/ui/${utils.getGTKString()}/Hexagon.ui`);

    // Bind all properties.
    dialog.bindAdjustment('hexagon-animation-time');
    dialog.bindAdjustment('hexagon-scale');
    dialog.bindAdjustment('hexagon-line-width');
    dialog.bindColorButton('hexagon-line-color');
    dialog.bindColorButton('hexagon-glow-color');
    dialog.bindSwitch('hexagon-additive-blending');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('hexagon-prefs');
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

  // For this effect, windows should neither be scaled nor faded.
  static tweakTransition(actor, settings, forOpening) {
    return {
      'opacity': {from: 255, to: 255, mode: 1},
      'scale-x': {from: 1.0, to: 1.0, mode: 1},
      'scale-y': {from: 1.0, to: 1.0, mode: 1}
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

      this._uAdditiveBlending = this.get_uniform_location('uAdditiveBlending');
      this._uSeed             = this.get_uniform_location('uSeed');
      this._uScale            = this.get_uniform_location('uScale');
      this._uLineWidth        = this.get_uniform_location('uLineWidth');
      this._uGlowColor        = this.get_uniform_location('uGlowColor');
      this._uLineColor        = this.get_uniform_location('uLineColor');
    }

    // This is called each time the effect is used. This can be used to retrieve the
    // configuration from the settings and update all uniforms accordingly.
    setUniforms(actor, settings, forOpening) {

      // Get the two configurable colors. They are directly injected into the shader code
      // below.
      const gc = Clutter.Color.from_string(settings.get_string('hexagon-glow-color'))[1];
      const lc = Clutter.Color.from_string(settings.get_string('hexagon-line-color'))[1];

      // If we are currently performing integration test, the animation uses a fixed seed.
      const testMode = settings.get_boolean('test-mode');

      // clang-format off
      this.set_uniform_float(this._uAdditiveBlending, 1, [settings.get_boolean('hexagon-additive-blending')]);
      this.set_uniform_float(this._uSeed,             2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
      this.set_uniform_float(this._uScale,            1, [settings.get_double('hexagon-scale')]);
      this.set_uniform_float(this._uLineWidth,        1, [settings.get_double('hexagon-line-width')]);
      this.set_uniform_float(this._uGlowColor,        4, [gc.red / 255, gc.green / 255, gc.blue / 255, gc.alpha / 255]);
      this.set_uniform_float(this._uLineColor,        4, [lc.red / 255, lc.green / 255, lc.blue / 255, lc.alpha / 255]);
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

      // Feel free to read the inline comments below to learn how this shader works.
      const declarations = `

        // Inject some common shader snippets.
        ${shaderSnippets.standardUniforms()}
        ${shaderSnippets.noise()}

        uniform bool  uAdditiveBlending;
        uniform vec2  uSeed;
        uniform float uScale;
        uniform float uLineWidth;
        uniform vec4  uGlowColor;
        uniform vec4  uLineColor;

        // This methods generates a procedural hexagonal pattern. It returns four values:
        // result.xy: This contains cell-relative coordinates for the given point.
        //            [0, 0] is in the center of a cell, [0, 1] at the upper edge,
        //            [sqrt(4.0 / 3.0), 0] at the right tip and so on.
        // result.z:  This is the distance to the closest edge. This is used for shrinking
        //            of the tiles and the sharp overlay lines.
        // result.w:  This is the distance to the closest cell center. This is used for
        //            the glow effect.
        vec4 getHexagons(vec2 p) {

          // Length of a cell's edge.
          const float edgeLength = sqrt(4.0 / 3.0);
        
          // The hexgrid repeats after this distance.
          const vec2 scale = vec2(3.0 * edgeLength, 2.0);
        
          // This is a repeating grid of scale-sized cells. Y-values are in the
          // interval [-1...1], X-value in [-1.5*edgeLength...1.5*edgeLength].
          vec2 a = mod(p, scale) - scale * 0.5;
          vec2 aAbs = abs(a);
        
          // This is the same as above, but offset by half scale.
          vec2 b = mod(p + scale * 0.5, scale) - scale * 0.5;
          vec2 bAbs = abs(b);
        
          // Distance to closer edge, diagonally or horizontally.
          // Once for cell set A and once for cell set B.
          float distA = max(aAbs.x / edgeLength + aAbs.y * 0.5, aAbs.y);
          float distB = max(bAbs.x / edgeLength + bAbs.y * 0.5, bAbs.y);
        
          // Minimum of both is distance to closest edge.
          float dist = 1.0 - min(distA, distB);
        
          // We use the radial distance to the center for glow.
          float glow = min(dot(a, a), dot(b, b)) / 1.5;
        
          // Take cell-relative coordinates from the closer cell.
          vec2 cellCoords = distA < distB ? a : b;
        
          return vec4(cellCoords, dist, glow);
        }
      `;

      const code = `
        // We simply inverse the progress for opening windows.
        float progress = uForOpening ? 1.0-uProgress : uProgress;

        // Add some smooth noise to the progress so that not every tile behaves the
        // same.
        float noise = simplex2D(cogl_tex_coord_in[0].st + uSeed);
        progress = clamp(mix(noise - 1.0, noise + 1.0, progress), 0.0, 1.0);

        // glowProgress fades in in the first half of the animation, tileProgress fades
        // in in the second half.
        float glowProgress = smoothstep(0, 1, clamp(progress / 0.5, 0, 1));
        float tileProgress = smoothstep(0, 1, clamp((progress - 0.5) / 0.5, 0, 1));

        vec2 texScale = 0.1 * uSize / uScale;
        vec4 hex = getHexagons(cogl_tex_coord_in[0].st * texScale);

        if (tileProgress > hex.z) {

          // Crop outer parts of the shrinking tiles.
          cogl_color_out.a = 0.0;

        } else {

          // Make the tiles shrink by offsetting the texture lookup towards the edge
          // of the cell.
          vec2 lookupOffset = tileProgress * hex.xy / texScale / (1.0 - tileProgress);
          cogl_color_out = texture2D(uTexture, cogl_tex_coord_in[0].st + lookupOffset);

          // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
          if (cogl_color_out.a > 0) {
            cogl_color_out.rgb /= cogl_color_out.a;
          }

          vec4 glow = uGlowColor;
          vec4 line = uLineColor;

          // For the glow, we accumulate a few exponentially scaled versions of hex.w.
          glow.a *= pow(hex.w, 20.0) * 10.0 +
                    pow(hex.w, 10.0) * 5.0 +
                    pow(hex.w,  2.0) * 0.5;
          
          // Using step(uLineWidth, hex.z) would be simpler, but the below creates some
          // fake antialiasing.
          line.a *= 1.0 - smoothstep(uLineWidth*0.02*0.5, uLineWidth*0.02, hex.z);

          // Fade in the glowing lines.
          glow.a *= glowProgress;
          line.a *= glowProgress;

          // Do not add the hexagon lines onto transparent parts of the window.
          glow *= cogl_color_out.a;
          line *= cogl_color_out.a;

          if (uAdditiveBlending) {
            cogl_color_out.rgb += glow.rgb * glow.a;
            cogl_color_out.rgb += line.rgb * line.a;
          } else {
            cogl_color_out.rgb = mix(cogl_color_out.rgb, glow.rgb, glow.a);
            cogl_color_out.rgb = mix(cogl_color_out.rgb, line.rgb, line.a);
          }
        }
      `;

      this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, declarations, code, true);
    }
  });
}