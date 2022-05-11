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
// This effect looks a bit like the transporter effect from TOS.                        //
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
var EnergizeA = class EnergizeA {

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
    return 'energize-a';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Energize A');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource(`/ui/${utils.getGTKString()}/EnergizeA.ui`);

    // Bind all properties.
    dialog.bindAdjustment('energize-a-animation-time');
    dialog.bindAdjustment('energize-a-scale');
    dialog.bindColorButton('energize-a-color');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('energize-a-prefs');
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
      'opacity': {from: 255, to: 255, mode: 3},
      'scale-x': {from: 1.0, to: 1.0, mode: 3},
      'scale-y': {from: 1.0, to: 1.0, mode: 3}
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

      this._uColor = this.get_uniform_location('uColor');
      this._uScale = this.get_uniform_location('uScale');
    }

    // This is called each time the effect is used. This can be used to retrieve the
    // configuration from the settings and update all uniforms accordingly.
    setUniforms(actor, settings, forOpening) {
      const c = Clutter.Color.from_string(settings.get_string('energize-a-color'))[1];

      // clang-format off
      this.set_uniform_float(this._uColor, 3, [c.red / 255, c.green / 255, c.blue / 255]);
      this.set_uniform_float(this._uScale, 1, [settings.get_double('energize-a-scale')]);
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

        uniform vec3  uColor;
        uniform float uScale;

        const float FADE_IN_TIME    = 0.3;
        const float FADE_OUT_TIME   = 0.6;
        const float HEART_FADE_TIME = 0.3;
        const float EDGE_FADE_WIDTH = 50;

        // This method returns two values:
        //  result.x: A mask for the particles.
        //  result.y: The opacity of the fading window.
        vec2 getMasks() {
          float fadeInProgress  = clamp(uProgress/FADE_IN_TIME, 0, 1);
          float fadeOutProgress = clamp((uProgress-FADE_IN_TIME)/FADE_OUT_TIME, 0, 1);
          float heartProgress   = clamp((uProgress-(1.0-HEART_FADE_TIME))/HEART_FADE_TIME, 0, 1);

          // Compute mask for the "atom" particles.
          float dist = length(cogl_tex_coord_in[0].st - 0.5) * 4.0;
          float atomMask = smoothstep(0.0, 1.0, (fadeInProgress * 2.0 - dist + 1.0));
          atomMask *= fadeInProgress;
          atomMask *= smoothstep(1.0, 0.0, fadeOutProgress);

          // Fade-out the masks at the window edges.
          float edgeFade = getAbsoluteEdgeMask(EDGE_FADE_WIDTH);
          atomMask *= edgeFade;

          float heartMask = getRelativeEdgeMask(0.5);
          heartMask = 3.0 * pow(heartMask, 5);
          heartMask *= fadeOutProgress;
          heartMask *= 1.0 - heartProgress;
          atomMask = clamp(heartMask+atomMask, 0, 1);

          // Compute fading window opacity.
          float windowMask = pow(1.0 - fadeOutProgress, 2.0);

          if (uForOpening) {
            windowMask = 1.0 - windowMask;
          }

          return vec2(atomMask, windowMask);
        }
      `;

      const code = `
        vec2 masks       = getMasks();
        vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);

        // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
        if (windowColor.a > 0) {
          windowColor.rgb /= windowColor.a;
        }

        // Dissolve window to effect color / transparency.
        cogl_color_out.rgb = mix(uColor, windowColor.rgb, 0.2 * masks.y + 0.8);
        cogl_color_out.a = windowColor.a * masks.y;

        vec2 scaledUV = (cogl_tex_coord_in[0].st-0.5) * (1.0 + 0.1*uProgress);
        scaledUV /= uScale;

        // Add molecule particles.
        vec2 uv = scaledUV + vec2(0, 0.1*uTime);
        uv *= 0.010598 * vec2(0.5*uSize.x, uSize.y);
        float particles = 0.2 * pow((simplex3D(vec3(uv, 0.0*uTime))), 3.0);

        // Add more molecule particles.
        for (int i=1; i<=3;++i) {
          vec2 uv = scaledUV * 0.12154 / pow(1.5, i) * uSize;
          float atoms = simplex3D(vec3(uv, 2.0*uTime/i));
          particles += 0.5 * pow(0.2 * (1.0 / (1.0 - atoms)-1.0), 2);
        }

        cogl_color_out.rgb += uColor * particles * masks.x;
        cogl_color_out.a += particles * masks.x;

        // These are pretty useful for understanding how this works.
        // cogl_color_out = vec4(masks, 0.0, 1.0);
        // cogl_color_out = vec4(vec3(masks.x), 1.0);
        // cogl_color_out = vec4(vec3(masks.y), 1.0);
        // cogl_color_out = vec4(vec3(particles), 1.0);
      `;

      this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, declarations, code, true);
    }
  });
}