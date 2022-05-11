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
// The Matrix shader multiplies a grid of random letters with some gradients which are  //
// moving from top to bottom. The speed of the moving gradients is chosen randomly.     //
// Also, there is a random delay making the gradients not drop all at the same time.    //
// This effect is not available on GNOME 3.3x, due to the limitation described in the   //
// documentation of vfunc_paint_target further down in this file.                       //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file. When this
// effect is used for the first time, an instance of this shader class is created. Once
// the effect is finished, the shader will be stored in the freeShaders array and will
// then be reused if a new shader is requested. ShaderClass which will be used whenever
// this effect is used.
let ShaderClass = null;
let freeShaders = [];

// This texture will be loaded when the effect is used for the first time.
let fontTexture = null;

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
  // effect is enabled currently (e.g. '*-close-effect'), and its animation time
  // (e.g. '*-animation-time').
  static getNick() {
    return 'matrix';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Matrix');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource('/ui/gtk4/Matrix.ui');

    // Bind all properties.
    dialog.bindAdjustment('matrix-animation-time');
    dialog.bindAdjustment('matrix-scale');
    dialog.bindAdjustment('matrix-randomness');
    dialog.bindAdjustment('matrix-overshoot');
    dialog.bindColorButton('matrix-trail-color');
    dialog.bindColorButton('matrix-tip-color');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('matrix-prefs');
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

  // For this effect, windows should not be faded but scaled vertically to allow for some
  // overshooting.
  static tweakTransition(actor, settings, forOpening) {
    const yScale = 1.0 + settings.get_double('matrix-overshoot');
    return {
      'opacity': {from: 255, to: 255, mode: 1},
      'scale-x': {from: 1.0, to: 1.0, mode: 1},
      'scale-y': {from: yScale, to: yScale, mode: 1}
    };
  }

  // This is called from extension.js if the extension is disabled. This should free all
  // static resources.
  static cleanUp() {
    freeShaders = [];
    fontTexture = null;
  }
}


//////////////////////////////////////////////////////////////////////////////////////////
// The shader class for this effect will only be registered in GNOME Shell's process    //
// (not in the preferences process). It's done this way as Clutter may not be installed //
// on the system and therefore the preferences would crash.                             //
//////////////////////////////////////////////////////////////////////////////////////////

if (utils.isInShellProcess()) {

  const {Clutter, GdkPixbuf, Cogl, Shell} = imports.gi;
  const shaderSnippets                    = Me.imports.src.shaderSnippets;

  ShaderClass = GObject.registerClass({}, class ShaderClass extends Shell.GLSLEffect {
    // This is called when the effect is used for the first time. This can be used to
    // store all required uniform locations.
    _init() {
      super._init();

      // Load the font texture.
      if (fontTexture == null) {
        const fontData = GdkPixbuf.Pixbuf.new_from_resource('/img/matrixFont.png');
        fontTexture    = new Clutter.Image();
        fontTexture.set_data(
          fontData.get_pixels(),
          fontData.has_alpha ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
          fontData.width, fontData.height, fontData.rowstride);
      }

      this._uForOpening  = this.get_uniform_location('uForOpening');
      this._uFontTexture = this.get_uniform_location('uFontTexture');
      this._uTrailColor  = this.get_uniform_location('uTrailColor');
      this._uTipColor    = this.get_uniform_location('uTipColor');
      this._uLetterSize  = this.get_uniform_location('uLetterSize');
      this._uRandomness  = this.get_uniform_location('uRandomness');
      this._uOverShoot   = this.get_uniform_location('uOverShoot');
    }

    // This is called each time the effect is used. This can be used to retrieve the
    // configuration from the settings and update all uniforms accordingly.
    setUniforms(actor, settings, forOpening) {
      const c1 = Clutter.Color.from_string(settings.get_string('matrix-trail-color'))[1];
      const c2 = Clutter.Color.from_string(settings.get_string('matrix-tip-color'))[1];

      // clang-format off
      this.set_uniform_float(this._uForOpening, 1, [forOpening]);
      this.set_uniform_float(this._uTrailColor, 3, [c1.red / 255, c1.green / 255, c1.blue / 255]);
      this.set_uniform_float(this._uTipColor,   3, [c2.red / 255, c2.green / 255, c2.blue / 255]);
      this.set_uniform_float(this._uLetterSize, 1, [settings.get_int('matrix-scale')]);
      this.set_uniform_float(this._uRandomness, 1, [settings.get_double('matrix-randomness')]);
      this.set_uniform_float(this._uOverShoot,  1, [settings.get_double('matrix-overshoot')]);
      // clang-format on
    }

    // This is called by extension.js when the shader is not used anymore. We will store
    // this instance of the shader so that it can be re-used in th future.
    free() {
      freeShaders.push(this);
    }

    // This is called by the constructor. This means, it's only called when the effect
    // is used for the first time. The technique for this effect was inspired by
    // https://www.shadertoy.com/view/ldccW4, however the implementation is quite
    // different as the letters drop only once and there is no need for a noise texture.
    vfunc_build_pipeline() {
      const declarations = `
        // Inject some common shader snippets.
        ${shaderSnippets.standardUniforms()}
        ${shaderSnippets.noise()}
        ${shaderSnippets.edgeMask()}
        ${shaderSnippets.compositing()}

        uniform bool      uForOpening;
        uniform sampler2D uFontTexture;
        uniform vec3      uTrailColor;
        uniform vec3      uTipColor;
        uniform float     uLetterSize;
        uniform float     uRandomness;
        uniform float     uOverShoot;

        // These may be configurable in the future.
        const float EDGE_FADE             = 30;
        const float FADE_WIDTH            = 150;
        const float TRAIL_LENGTH          = 0.2;
        const float FINAL_FADE_START_TIME = 0.8;
        const float LETTER_TILES          = 16.0;
        const float LETTER_FLICKER_SPEED  = 2.0;

        // This returns a flickering grid of random letters.
        float getText(vec2 fragCoord) {
          vec2 pixelCoords = fragCoord * uSize;
          vec2 uv = mod(pixelCoords.xy, uLetterSize)/uLetterSize;
          vec2 block = pixelCoords/uLetterSize - uv;

          // Choose random letter.
          uv += floor(hash22(floor(hash22(block)*vec2(12.9898,78.233) + LETTER_FLICKER_SPEED*uTime + 42.254))*LETTER_TILES);

          return texture2D(uFontTexture, uv/LETTER_TILES).r;
        }

        // This returns two values: The first are gradients for the "raindrops" which move
        // from top to bottom. This is used for fading the letters. The second value is set
        // to one below each drop and to zero above it. This second value is used for fading
        // the window texture. 
        vec2 getRain(vec2 fragCoord) {
          float column = cogl_tex_coord_in[0].x * uSize.x;
          column -= mod(column, uLetterSize);

          float delay = fract(sin(column)*78.233) * mix(0.0, 1.0, uRandomness);
          float speed = fract(cos(column)*12.989) * mix(0.0, 0.3, uRandomness) + 1.5;
          
          float distToDrop  = (uProgress*2-delay)*speed - cogl_tex_coord_in[0].y;
          
          float rainAlpha   = distToDrop >= 0 ? exp(-distToDrop/TRAIL_LENGTH) : 0;
          float windowAlpha = 1 - clamp(uSize.y*distToDrop, 0, FADE_WIDTH) / FADE_WIDTH;
          
          // Fade at window borders.
          rainAlpha *= getAbsoluteEdgeMask(EDGE_FADE);
          
          // Add some variation to the drop start and end position.
          float shorten = fract(sin(column+42.0)*33.423) * mix(0.0, uOverShoot*0.25, uRandomness);
          rainAlpha *= smoothstep(0, 1, clamp(cogl_tex_coord_in[0].y / shorten, 0, 1));
          rainAlpha *= smoothstep(0, 1, clamp((1.0 - cogl_tex_coord_in[0].y) / shorten, 0, 1));

          if (uForOpening) {
            windowAlpha = 1.0 - windowAlpha;
          }

          return vec2(rainAlpha, windowAlpha);
        }
      `;

      const code = `
        vec2 coords = cogl_tex_coord_in[0].st;
        coords.y = coords.y * (uOverShoot + 1.0) - uOverShoot * 0.5;

        // Get a cool matrix effect. See comments for those methods above.
        vec2  rainMask = getRain(coords);
        float textMask = getText(coords);

        // Get the window texture.
        cogl_color_out = texture2D(uTexture, coords);
        
        // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
        if (cogl_color_out.a > 0) {
          cogl_color_out.rgb /= cogl_color_out.a;
        }
        
        // Fade the window according to the effect mask.
        cogl_color_out.a *= rainMask.y;

        // This is used to fade out the remaining trails in the end.
        float finalFade = 1-clamp((uProgress-FINAL_FADE_START_TIME)/
                                  (1-FINAL_FADE_START_TIME), 0, 1);
        float rainAlpha = finalFade * rainMask.x;

        // Add the matrix effect to the window.
        vec4 text = vec4(mix(uTrailColor, uTipColor, min(1, pow(rainAlpha+0.1, 4))), rainAlpha * textMask);
        cogl_color_out = alphaOver(cogl_color_out, text);

        // These are pretty useful for understanding how this works.
        // cogl_color_out = vec4(vec3(textMask), 1);
        // cogl_color_out = vec4(vec3(rainMask.x), 1);
        // cogl_color_out = vec4(vec3(rainMask.y), 1);
      `;

      this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, declarations, code, true);
    }

    // This is overridden to bind the font texture for drawing. Sadly, this seems to be
    // impossible under GNOME 3.3x as this.get_pipeline() is not available. It was called
    // get_target() back then but this is not wrapped in GJS.
    // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
    vfunc_paint_target(node, paint_context) {
      const pipeline = this.get_pipeline();
      pipeline.set_layer_texture(1, fontTexture.get_texture());
      pipeline.set_uniform_1i(this._uFontTexture, 1);

      super.vfunc_paint_target(node, paint_context);
    }
  });
}