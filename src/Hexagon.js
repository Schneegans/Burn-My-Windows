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
const Effect         = Me.imports.src.Effect.Effect;

//////////////////////////////////////////////////////////////////////////////////////////
// This effect overlays a glowing hexagonal grid over the window. The grid cells then   //
// gradually shrink until the window is fully dissolved.                                //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var Hexagon = class Hexagon extends Effect {

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-close-effect'), and its animation time
  // (e.g. '*-animation-time').
  getNick() {
    return 'hexagon';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Hexagon');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // and binds all properties to the settings.
  getPreferences(dialog) {

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

  // This is called by the effect's base class whenever a new shader is required. Since
  // this shader depends on classes by GNOME Shell, we register it locally in this method
  // as this file is also included from the preferences dialog where those classes would
  // not be available.
  createShader() {

    // Only register the shader class when this method is called for the first time.
    if (!this._ShaderClass) {

      const Clutter = imports.gi.Clutter;
      const Shader  = Me.imports.src.Shader.Shader;

      this._ShaderClass = GObject.registerClass({}, class ShaderClass extends Shader {
        // We use the constructor of the shader to store all required uniform locations.
        _init(effect) {
          super._init(effect);

          this._uAdditiveBlending = this.get_uniform_location('uAdditiveBlending');
          this._uSeed             = this.get_uniform_location('uSeed');
          this._uScale            = this.get_uniform_location('uScale');
          this._uLineWidth        = this.get_uniform_location('uLineWidth');
          this._uGlowColor        = this.get_uniform_location('uGlowColor');
          this._uLineColor        = this.get_uniform_location('uLineColor');
        }

        // This is called once each  time the shader is used. This can be used to retrieve
        // the configuration from the settings and update all uniforms accordingly.
        beginAnimation(actor, settings, forOpening) {
          super.beginAnimation(actor, settings, forOpening);

          // Get the two configurable colors. They are directly injected into the shader
          // code below.
          const gc =
            Clutter.Color.from_string(settings.get_string('hexagon-glow-color'))[1];
          const lc =
            Clutter.Color.from_string(settings.get_string('hexagon-line-color'))[1];

          // If we are currently performing integration test, the animation uses a fixed
          // seed.
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
      });
    }

    // Finally, return a new instance of the shader class.
    return new this._ShaderClass(this);
  }
}
