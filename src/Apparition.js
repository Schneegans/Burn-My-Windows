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

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings) {
    return {x: 2.0, y: 2.0};
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

  const Shell = imports.gi.Shell;

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
      const decl =
        utils.loadGLSLResource(`/shaders/${Apparition.getNick()}-declarations.glsl`);
      const code = utils.loadGLSLResource(`/shaders/${Apparition.getNick()}.glsl`);

      this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, decl, code, true);
    }
  });
}