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

// The shader class for this effect is registered further down in this file. When this
// effect is used for the first time, an instance of this shader class is created. Once
// the effect is finished, the shader will be stored in the freeShaders array and will
// then be reused if a new shader is requested. ShaderClass which will be used whenever
// this effect is used.
let ShaderClass = null;
let freeShaders = [];

// This texture will be loaded when the effect is used for the first time.
let clawTexture = null;

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
    const scale = 1.0 + 0.5 * settings.get_double('claw-scratch-warp');
    return {x: scale, y: scale};
  }

  // This is called from extension.js if the extension is disabled. This should free all
  // static resources.
  static cleanUp() {
    freeShaders = [];
    clawTexture = null;
  }
}


//////////////////////////////////////////////////////////////////////////////////////////
// The shader class for this effect will only be registered in GNOME Shell's process    //
// (not in the preferences process). It's done this way as Clutter may not be installed //
// on the system and therefore the preferences would crash.                             //
//////////////////////////////////////////////////////////////////////////////////////////

if (utils.isInShellProcess()) {

  const {Clutter, GdkPixbuf, Cogl, Shell} = imports.gi;

  ShaderClass = GObject.registerClass({}, class ShaderClass extends Shell.GLSLEffect {
    // This is called when the effect is used for the first time. This can be used to
    // store all required uniform locations.
    _init() {
      super._init();

      // Load the claw texture.
      if (clawTexture == null) {
        const clawData = GdkPixbuf.Pixbuf.new_from_resource('/img/claws.png');
        clawTexture    = new Clutter.Image();
        clawTexture.set_data(clawData.get_pixels(), Cogl.PixelFormat.RGB_888,
                             clawData.width, clawData.height, clawData.rowstride);
      }

      this._uClawTexture   = this.get_uniform_location('uClawTexture');
      this._uFlashColor    = this.get_uniform_location('uFlashColor');
      this._uSeed          = this.get_uniform_location('uSeed');
      this._uClawSize      = this.get_uniform_location('uClawSize');
      this._uNumClaws      = this.get_uniform_location('uNumClaws');
      this._uWarpIntensity = this.get_uniform_location('uWarpIntensity');
    }

    // This is called each time the effect is used. This can be used to retrieve the
    // configuration from the settings and update all uniforms accordingly.
    setUniforms(actor, settings, forOpening) {
      const c = Clutter.Color.from_string(settings.get_string('claw-scratch-color'))[1];

      // If we are currently performing integration test, the animation uses a fixed seed.
      const testMode = settings.get_boolean('test-mode');

      // clang-format off
      this.set_uniform_float(this._uFlashColor,    4, [c.red / 255, c.green / 255, c.blue / 255, c.alpha / 255]);
      this.set_uniform_float(this._uSeed,          2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
      this.set_uniform_float(this._uClawSize,      1, [settings.get_double('claw-scratch-scale')]);
      this.set_uniform_float(this._uNumClaws,      1, [settings.get_int('claw-scratch-count')]);
      this.set_uniform_float(this._uWarpIntensity, 1, [settings.get_double('claw-scratch-warp')]);
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
      const code = utils.loadGLSLResource(`/shaders/${TRexAttack.getNick()}.glsl`);

      // Match anything between the curly brackets of "void main() {...}".
      const regex = RegExp('void main *\\(\\) *\\{([\\S\\s]+)\\}', 'd');
      const match = regex.exec(code);

      const declarations = code.substr(0, match.index);
      const main         = match[1];

      this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, declarations, main, true);
    }

    // This is overridden to bind the claw texture for drawing. Sadly, this seems to be
    // impossible under GNOME 3.3x as this.get_pipeline() is not available. It was called
    // get_target() back then but this is not wrapped in GJS.
    // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
    vfunc_paint_target(node, paint_context) {
      const pipeline = this.get_pipeline();
      pipeline.set_layer_texture(1, clawTexture.get_texture());
      pipeline.set_uniform_1i(this._uClawTexture, 1);

      super.vfunc_paint_target(node, paint_context);
    }
  });
}