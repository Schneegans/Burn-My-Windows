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

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings) {
    return {x: 1.0, y: 1.0};
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
      const code = utils.loadGLSLResource(`/shaders/${Hexagon.getNick()}.glsl`);

      // Match anything between the curly brackets of "void main() {...}".
      const regex = RegExp('void main *\\(\\) *\\{([\\S\\s]+)\\}', 'd');
      const match = regex.exec(code);

      const declarations = code.substr(0, match.index);
      const main         = match[1];

      this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, declarations, main, true);
    }
  });
}