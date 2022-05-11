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
// This effect hides the actor by violently sucking it into the void of magic.          //
// towards the middle and then hiding the resulting line from left and right towards    //
// the center.                                                                          //
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
var Apparition = class Apparition {

  // ---------------------------------------------------------------------------- metadata

  // The effect is not available on GNOME Shell 3.36 as it requires scaling of the window
  // actor.
  static getMinShellVersion() {
    return [3, 38];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-close-effect'), and its animation time
  // (e.g. '*-animation-time').
  static getNick() {
    return 'apparition';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Apparition');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource(`/ui/${utils.getGTKString()}/Apparition.ui`);

    // Bind all properties.
    dialog.bindAdjustment('apparition-randomness');
    dialog.bindAdjustment('apparition-animation-time');
    dialog.bindAdjustment('apparition-twirl-intensity');
    dialog.bindAdjustment('apparition-shake-intensity');
    dialog.bindAdjustment('apparition-suction-intensity');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('apparition-prefs');
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

  // For this effect, windows are set to twice their original size, so that we have
  // some space to draw the animation. We also set the animation mode to "Linear".
  static tweakTransition(actor, settings, forOpening) {
    return {
      'opacity': {from: 255, to: 255, mode: 1},
      'scale-x': {from: 2.0, to: 2.0, mode: 1},
      'scale-y': {from: 2.0, to: 2.0, mode: 1}
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

  const Shell          = imports.gi.Shell;
  const shaderSnippets = Me.imports.src.shaderSnippets;

  ShaderClass = GObject.registerClass({}, class ShaderClass extends Shell.GLSLEffect {
    // This is called when the effect is used for the first time. This can be used to
    // store all required uniform locations.
    _init() {
      super._init();

      this._uSeed       = this.get_uniform_location('uSeed');
      this._uShake      = this.get_uniform_location('uShake');
      this._uTwirl      = this.get_uniform_location('uTwirl');
      this._uSuction    = this.get_uniform_location('uSuction');
      this._uRandomness = this.get_uniform_location('uRandomness');
    }

    // This is called each time the effect is used. This can be used to retrieve the
    // configuration from the settings and update all uniforms accordingly.
    setUniforms(actor, settings, forOpening) {
      // If we are currently performing integration test, the animation uses a fixed seed.
      const testMode = settings.get_boolean('test-mode');

      // clang-format off
      this.set_uniform_float(this._uSeed,       2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
      this.set_uniform_float(this._uShake,      1, [settings.get_double('apparition-shake-intensity')]);
      this.set_uniform_float(this._uTwirl,      1, [settings.get_double('apparition-twirl-intensity')]);
      this.set_uniform_float(this._uSuction,    1, [settings.get_double('apparition-suction-intensity')]);
      this.set_uniform_float(this._uRandomness, 1, [settings.get_double('apparition-randomness')]);
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

        uniform vec2  uSeed;
        uniform float uShake;
        uniform float uTwirl;
        uniform float uSuction;
        uniform float uRandomness;

        const float ACTOR_SCALE = 2.0;
        const float PADDING     = ACTOR_SCALE / 2.0 - 0.5;
      `;

      // The math for the whirling is inspired by this post:
      // http://www.geeks3d.com/20110428/shader-library-swirl-post-processing-filter-in-glsl
      const code = `
        // We simply inverse the progress for opening windows.
        float progress = uForOpening ? 1.0-uProgress : uProgress;

        // Choose a random suction center.
        vec2 center = uSeed * uRandomness + 0.5 * (1.0 - uRandomness);
        vec2 coords = cogl_tex_coord_in[0].st * ACTOR_SCALE - PADDING - center;

        // Add some shaking.
        coords.x += progress * 0.05 * uShake * sin((progress + uSeed.x) * (1.0 + uSeed.x) * uShake);
        coords.y += progress * 0.05 * uShake * cos((progress + uSeed.y) * (1.0 + uSeed.y) * uShake);

        // "Suck" the texture into the center.
        float dist = length(coords) / sqrt(2);
        coords += progress * coords / dist * 0.5 * uSuction;

        // Apply some whirling.
        float angle = pow(1.0 - dist, 2.0) * uTwirl * progress;
        float s = sin(angle);
        float c = cos(angle);
        coords = vec2(dot(coords, vec2(c, -s)), dot(coords, vec2(s, c)));

        // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
        cogl_color_out = texture2D(uTexture, coords + center);
        if (cogl_color_out.a > 0) {
          cogl_color_out.rgb /= cogl_color_out.a;
        }

        // Fade out the window texture.
        cogl_color_out.a *= 1.0 - progress;
      `;

      this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, declarations, code, true);
    }
  });
}