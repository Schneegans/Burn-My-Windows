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
// This effect hides the actor by violently sucking it into the void of magic.          //
// towards the middle and then hiding the resulting line from left and right towards    //
// the center.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var Apparition = class Apparition extends Effect {

  // ---------------------------------------------------------------------------- metadata

  // The effect is not available on GNOME Shell 3.36 as it requires scaling of the window
  // actor.
  getMinShellVersion() {
    return [3, 38];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-close-effect'), and its animation time
  // (e.g. '*-animation-time').
  getNick() {
    return 'apparition';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Apparition');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // and binds all properties to the settings.
  getPreferences(dialog) {

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

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  getActorScale(settings) {
    return {x: 2.0, y: 2.0};
  }

  // This is called by the effect's base class whenever a new shader is required. Since
  // this shader depends on classes by GNOME Shell, we register it locally in this method
  // as this file is also included from the preferences dialog where those classes would
  // not be available.
  createShader() {

    // Only register the shader class when this method is called for the first time.
    if (!this._ShaderClass) {

      const Shader = Me.imports.src.Shader.Shader;

      this._ShaderClass = GObject.registerClass({}, class ShaderClass extends Shader {
        // We use the constructor of the shader to store all required uniform locations.
        _init(effect) {
          super._init(effect);

          this._uSeed       = this.get_uniform_location('uSeed');
          this._uShake      = this.get_uniform_location('uShake');
          this._uTwirl      = this.get_uniform_location('uTwirl');
          this._uSuction    = this.get_uniform_location('uSuction');
          this._uRandomness = this.get_uniform_location('uRandomness');
        }

        // This is called once each  time the shader is used. This can be used to retrieve
        // the configuration from the settings and update all uniforms accordingly.
        beginAnimation(actor, settings, forOpening) {
          super.beginAnimation(actor, settings, forOpening);

          // If we are currently performing integration test, the animation uses a fixed
          // seed.
          const testMode = settings.get_boolean('test-mode');

          // clang-format off
          this.set_uniform_float(this._uSeed,       2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
          this.set_uniform_float(this._uShake,      1, [settings.get_double('apparition-shake-intensity')]);
          this.set_uniform_float(this._uTwirl,      1, [settings.get_double('apparition-twirl-intensity')]);
          this.set_uniform_float(this._uSuction,    1, [settings.get_double('apparition-suction-intensity')]);
          this.set_uniform_float(this._uRandomness, 1, [settings.get_double('apparition-randomness')]);
          // clang-format on
        }
      });
    }

    // Finally, return a new instance of the shader class.
    return new this._ShaderClass(this);
  }
}
