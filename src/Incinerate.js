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
const ShaderFactory  = Me.imports.src.ShaderFactory.ShaderFactory;

//////////////////////////////////////////////////////////////////////////////////////////
// This effect burns windows to ashes. The fire starts at a random position at the      //
// window's boundary and then burns through the window in a circular shape.             //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var Incinerate = class {

  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.
  constructor() {
    this.shaderFactory = new ShaderFactory(this.getNick(), (shader) => {
      // We import these modules in this function as they are not available in the
      // preferences process. This callback is only called within GNOME Shell's process.
      const {Clutter} = imports.gi;

      // Store uniform locations of newly created shaders.
      shader._uSeed       = shader.get_uniform_location('uSeed');
      shader._uColor      = shader.get_uniform_location('uColor');
      shader._uScale      = shader.get_uniform_location('uScale');
      shader._uTurbulence = shader.get_uniform_location('uTurbulence');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        const c = Clutter.Color.from_string(settings.get_string('incinerate-color'))[1];

        // If we are currently performing integration test, the animation uses a fixed
        // seed.
        const testMode = settings.get_boolean('test-mode');

        // clang-format off
        shader.set_uniform_float(shader._uSeed,  2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
        shader.set_uniform_float(shader._uColor, 3, [c.red / 255, c.green / 255, c.blue / 255]);
        shader.set_uniform_float(shader._uScale, 1, [settings.get_double('incinerate-scale')]);
        shader.set_uniform_float(shader._uTurbulence, 1, [settings.get_double('incinerate-turbulence')]);
        // clang-format on
      });
    });
  }

  // ---------------------------------------------------------------------------- metadata

  // This effect is available on all supported GNOME Shell versions.
  getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-close-effect'), and its animation time
  // (e.g. '*-animation-time').
  getNick() {
    return 'incinerate';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Incinerate');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // and binds all properties to the settings.
  getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource(`/ui/${utils.getGTKString()}/Incinerate.ui`);

    // Bind all properties.
    dialog.bindAdjustment('incinerate-animation-time');
    dialog.bindAdjustment('incinerate-scale');
    dialog.bindAdjustment('incinerate-turbulence');
    dialog.bindColorButton('incinerate-color');

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('incinerate-prefs');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  getActorScale(settings) {
    return {x: 1.0, y: 1.0};
  }
}