//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Justin Garza JGarza9788@gmail.com
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

// Import the Gio module from the GNOME platform (GObject Introspection).
// This module provides APIs for I/O operations, settings management, and other core
// features.
import Gio from 'gi://Gio';

// Import utility functions from the local utils.js file.
// These utilities likely contain helper functions or shared logic used across the
// application.
import * as utils from '../utils.js';

// We import the ShaderFactory only in the Shell process as it is not required in the
// preferences process. The preferences process does not create any shader instances, it
// only uses the static metadata of the effect.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// I thought to myself, i said "self what would a unicorn fart look like" and then i came
// up with this, and i don't care that i'm out of the box, i think outside of the box,
// yeah f*ck that box!
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
export default class Effect {
  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.
  constructor() {
    this.shaderFactory = new ShaderFactory(Effect.getNick(), (shader) => {
      // Store uniform locations of newly created shaders.

      // shader._uParticles = shader.get_uniform_location('uParticles');
      // shader._uParticleSize = shader.get_uniform_location('uParticleSize');
      // shader._uParticleSpeed = shader.get_uniform_location('uParticleSpeed');
      // shader._uParticleColorRandom =
      // shader.get_uniform_location('uParticleColorRandom'); shader._uParticleColorSpeed
      // = shader.get_uniform_location('uParticleColorSpeed');

      shader._uSparkCount    = shader.get_uniform_location('uSparkCount');
      shader._uSparkStartEnd = shader.get_uniform_location('uSparkStartEnd');
      shader._uSparkOffset   = shader.get_uniform_location('uSparkOffset');
      shader._uSparkCount    = shader.get_uniform_location('uSparkCount');

      shader._uStarCount    = shader.get_uniform_location('uStarCount');
      shader._uStarRot      = shader.get_uniform_location('uStarRot');
      shader._uStarSize     = shader.get_uniform_location('uStarSize');
      shader._uStarStartEnd = shader.get_uniform_location('uStarStartEnd');

      shader._uBlurQuality = shader.get_uniform_location('uBlurQuality');
      shader._uSeed        = shader.get_uniform_location('uSeed');

      shader._uStarColors = [
        shader.get_uniform_location('uStarColor0'),
        shader.get_uniform_location('uStarColor1'),
        shader.get_uniform_location('uStarColor2'),
        shader.get_uniform_location('uStarColor3'),
        shader.get_uniform_location('uStarColor4'),
        shader.get_uniform_location('uStarColor5'),
      ];

      shader._uParticleColors = [
        shader.get_uniform_location('uSparkColor0'),
        shader.get_uniform_location('uSparkColor1'),
        shader.get_uniform_location('uSparkColor2'),
        shader.get_uniform_location('uSparkColor3'),
        shader.get_uniform_location('uSparkColor4'),
        shader.get_uniform_location('uSparkColor5'),
      ];

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        for (let i = 0; i <= 5; i++) {
          shader.set_uniform_float(
            shader._uStarColors[i], 4,
            utils.parseColor(settings.get_string('unicorn-fart-star-color-' + i)));
        }

        for (let i = 0; i <= 5; i++) {
          shader.set_uniform_float(
            shader._uParticleColors[i], 4,
            utils.parseColor(settings.get_string('unicorn-fart-spark-color-' + i)));
        }


        shader.set_uniform_float(shader._uSparkCount, 1,
                                 [settings.get_int('unicorn-fart-spark-count')]);

        shader.set_uniform_float(shader._uSparkStartEnd, 2, [
          settings.get_double('unicorn-fart-spark-start'),
          settings.get_double('unicorn-fart-spark-end')
        ]);

        shader.set_uniform_float(shader._uSparkOffset, 1,
                                 [settings.get_double('unicorn-fart-spark-offset')]);

        shader.set_uniform_float(shader._uStarCount, 1,
                                 [settings.get_int('unicorn-fart-star-count')]);

        shader.set_uniform_float(shader._uStarRot, 1,
                                 [settings.get_double('unicorn-fart-star-rotation')]);

        shader.set_uniform_float(shader._uStarSize, 1,
                                 [settings.get_double('unicorn-fart-star-size')]);

        shader.set_uniform_float(shader._uStarStartEnd, 2, [
          settings.get_double('unicorn-fart-star-start'),
          settings.get_double('unicorn-fart-star-end')
        ]);

        shader.set_uniform_float(shader._uBlurQuality, 1,
                                 [settings.get_double('unicorn-fart-blur-quality')]);

        shader.set_uniform_float(shader._uSeed, 1, [Math.random()]);
      });
    });
  }

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-enable-effect'), and its animation time
  // (e.g. '*-animation-time'). Also, the shader file and the settings UI files should be
  // named likes this.
  static getNick() {
    return 'unicorn-fart';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('UnicornFart');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    // Empty for now... Code is added here later in the tutorial!

    dialog.bindAdjustment('unicorn-fart-animation-time');

    dialog.bindAdjustment('unicorn-fart-spark-count');
    dialog.bindAdjustment('unicorn-fart-spark-start');
    dialog.bindAdjustment('unicorn-fart-spark-end');
    dialog.bindAdjustment('unicorn-fart-spark-offset');

    dialog.bindAdjustment('unicorn-fart-star-count');
    dialog.bindAdjustment('unicorn-fart-star-rotation');
    dialog.bindAdjustment('unicorn-fart-star-size');
    dialog.bindAdjustment('unicorn-fart-star-start');
    dialog.bindAdjustment('unicorn-fart-star-end');
    dialog.bindAdjustment('unicorn-fart-blur-quality');

    // switches
    dialog.bindSwitch('unicorn-fart-particles-enable');

    // star-color
    dialog.bindColorButton('unicorn-fart-star-color-0');
    dialog.bindColorButton('unicorn-fart-star-color-1');
    dialog.bindColorButton('unicorn-fart-star-color-2');
    dialog.bindColorButton('unicorn-fart-star-color-3');
    dialog.bindColorButton('unicorn-fart-star-color-4');
    dialog.bindColorButton('unicorn-fart-star-color-5');

    // particle-colors
    dialog.bindColorButton('unicorn-fart-spark-color-0');
    dialog.bindColorButton('unicorn-fart-spark-color-1');
    dialog.bindColorButton('unicorn-fart-spark-color-2');
    dialog.bindColorButton('unicorn-fart-spark-color-3');
    dialog.bindColorButton('unicorn-fart-spark-color-4');
    dialog.bindColorButton('unicorn-fart-spark-color-5');



    // Ensure the button connections and other bindings happen only once,
    // even if the bindPreferences function is called multiple times.
    if (!Effect._isConnected) {
      Effect._isConnected = true;

      // Bind the "reset-unicorn-fart-spark-colors" button to reset all star colors to
      // their default values.
      dialog.getBuilder()
        .get_object('reset-unicorn-fart-spark-colors')
        .connect('clicked', () => {
          // Reset each mushroom star color setting.
          dialog.getProfileSettings().reset('unicorn-fart-spark-color-0');
          dialog.getProfileSettings().reset('unicorn-fart-spark-color-1');
          dialog.getProfileSettings().reset('unicorn-fart-spark-color-2');
          dialog.getProfileSettings().reset('unicorn-fart-spark-color-3');
          dialog.getProfileSettings().reset('unicorn-fart-spark-color-4');
          dialog.getProfileSettings().reset('unicorn-fart-spark-color-5');
        });

      dialog.getBuilder()
        .get_object('reset-unicorn-fart-star-colors')
        .connect('clicked', () => {
          // Reset each mushroom star color setting.
          dialog.getProfileSettings().reset('unicorn-fart-star-color-0');
          dialog.getProfileSettings().reset('unicorn-fart-star-color-1');
          dialog.getProfileSettings().reset('unicorn-fart-star-color-2');
          dialog.getProfileSettings().reset('unicorn-fart-star-color-3');
          dialog.getProfileSettings().reset('unicorn-fart-star-color-4');
          dialog.getProfileSettings().reset('unicorn-fart-star-color-5');
        });


      // Initialize the preset dropdown menu for mushroom star colors.
      Effect._createUnicornFartPresets(dialog);
    }
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 2.0, y: 2.0};
  }

  // ---------------------------------------------------------------- Presets

  // This function initializes the preset dropdown menu for configuring fire options.
  // It defines multiple color presets for the "mushroom star" effect and sets up
  // the logic to apply these presets when selected.

  static _createUnicornFartPresets(dialog) {
    // Retrieve the builder object for the dialog and connect to the "realize" event of
    // the button.
    dialog.getBuilder()
      .get_object('unicorn-fart-preset-button')
      .connect('realize', (widget) => {
        // Define an array of color presets, each with a name and six color values (RGBA
        // format).
        const presets = [
          {
            name: _('Unicorn Fart (Default)'),
            SparkCount: 25,
            SparkStart: 0.0,
            SparkEnd: 1.0,
            SparkOffset: 1.0,

            StarCount: 6,
            StarRot: 0.33,
            StarSize: 0.10,
            StarStart: 0.0,
            StarEnd: 1.0,

            BlurQuality:5.0,

            Sparkcolor0: 'rgba(255,255,255,1.0)',
            Sparkcolor1: 'rgba(255,255,255,1.0)',
            Sparkcolor2: 'rgba(255,255,255,1.0)',
            Sparkcolor3: 'rgba(255,255,255,1.0)',
            Sparkcolor4: 'rgba(255,255,255,1.0)',
            Sparkcolor5: 'rgba(255,255,255,1.0)',


            Starcolor0: 'rgba(255,0,0,1.0)',
            Starcolor1: 'rgba(255,255,0,1.0)',
            Starcolor2: 'rgba(0,255,0,1.0)',
            Starcolor3: 'rgba(0,255,255,1.0)',
            Starcolor4: 'rgba(0,0,255,1.0)',
            Starcolor5: 'rgba(255,0,255,1.0)',


          },
          {
            name: _('Fairy🧚'),
            SparkCount: 100,
            SparkStart: 0.0,
            SparkEnd: 1.0,
            SparkOffset: 1.0,

            StarCount: 0,
            StarRot: 0.33,
            StarSize: 0.10,
            StarStart: 0.0,
            StarEnd: 1.0,

            BlurQuality:5.0,

            Sparkcolor0: 'rgba(255,255,255,1.0)',
            Sparkcolor1: 'rgba(255,255,255,1.0)',
            Sparkcolor2: 'rgba(255,255,255,1.0)',
            Sparkcolor3: 'rgba(255,255,255,1.0)',
            Sparkcolor4: 'rgba(255,255,255,1.0)',
            Sparkcolor5: 'rgba(255,255,255,1.0)',


            Starcolor0: 'rgba(255,0,0,1.0)',
            Starcolor1: 'rgba(255,255,0,1.0)',
            Starcolor2: 'rgba(0,255,0,1.0)',
            Starcolor3: 'rgba(0,255,255,1.0)',
            Starcolor4: 'rgba(0,0,255,1.0)',
            Starcolor5: 'rgba(255,0,255,1.0)',


          },
          {
            name: _('Ring of Fire ❤️‍🔥'),
            SparkCount: 100,
            SparkStart: 0.0,
            SparkEnd: 1.0,
            SparkOffset: 1.0,

            StarCount: 25,
            StarRot: 3.0,
            StarSize: 0.10,
            StarStart: 0.0,
            StarEnd: 1.0,

            BlurQuality:5.0,

            Sparkcolor0: 'rgba(255,0,0,1.0)',       // Deep red
            Sparkcolor1: 'rgba(255,69,0,1.0)',      // Fiery orange-red
            Sparkcolor2: 'rgba(255,140,0,1.0)',     // Orange
            Sparkcolor3: 'rgba(255,215,0,1.0)',     // Bright yellow
            Sparkcolor4: 'rgba(255,255,102,1.0)',   // Light yellow
            Sparkcolor5: 'rgba(255,255,255,1.0)',   // White (hottest point)

            Starcolor0: 'rgba(255,0,0,1.0)',       // Deep red
            Starcolor1: 'rgba(255,69,0,1.0)',      // Fiery orange-red
            Starcolor2: 'rgba(255,140,0,1.0)',     // Orange
            Starcolor3: 'rgba(255,215,0,1.0)',     // Bright yellow
            Starcolor4: 'rgba(255,255,102,1.0)',   // Light yellow
            Starcolor5: 'rgba(255,255,255,1.0)',   // White (hottest point)
            


          },
        ];

        // Create a new menu model to hold the presets and an action group for handling
        // selections.
        const menu      = Gio.Menu.new();
        const group     = Gio.SimpleActionGroup.new();
        const groupName = 'presets';

        // Iterate over the presets to populate the menu.
        presets.forEach((preset, i) => {
          // Define an action name based on the preset index.
          const actionName = 'unicorn-fart' + i;

          // Append the preset name to the menu.
          menu.append(preset.name, groupName + '.' + actionName);

          // Create a new action for the preset.
          let action = Gio.SimpleAction.new(actionName, null);

          // Connect the action to a function that loads the preset colors into the
          // dialog.
          action.connect('activate', () => {
            dialog.getProfileSettings().set_int('unicorn-fart-spark-count',preset.SparkCount);
            dialog.getProfileSettings().set_double('unicorn-fart-spark-start',preset.SparkStart);
            dialog.getProfileSettings().set_double('unicorn-fart-spark-end',preset.SparkEnd);
            dialog.getProfileSettings().set_double('unicorn-fart-spark-offset',preset.SparkOffset);

            dialog.getProfileSettings().set_int('unicorn-fart-star-count',preset.StarCount);
            dialog.getProfileSettings().set_double('unicorn-fart-star-rotation',preset.StarRot);
            dialog.getProfileSettings().set_double('unicorn-fart-star-size',preset.StarSize);
            dialog.getProfileSettings().set_double('unicorn-fart-star-start',preset.StarStart);
            dialog.getProfileSettings().set_double('unicorn-fart-star-end',preset.StarEnd);

            dialog.getProfileSettings().set_double('unicorn-fart-blur-quality',preset.BlurQuality);
            
            dialog.getProfileSettings().set_string('unicorn-fart-spark-color-0',preset.Sparkcolor0);
            dialog.getProfileSettings().set_string('unicorn-fart-spark-color-1',preset.Sparkcolor1);
            dialog.getProfileSettings().set_string('unicorn-fart-spark-color-2',preset.Sparkcolor2);
            dialog.getProfileSettings().set_string('unicorn-fart-spark-color-3',preset.Sparkcolor3);
            dialog.getProfileSettings().set_string('unicorn-fart-spark-color-4',preset.Sparkcolor4);
            dialog.getProfileSettings().set_string('unicorn-fart-spark-color-5',preset.Sparkcolor5);

            dialog.getProfileSettings().set_string('unicorn-fart-star-color-0',preset.Starcolor0);
            dialog.getProfileSettings().set_string('unicorn-fart-star-color-1',preset.Starcolor1);
            dialog.getProfileSettings().set_string('unicorn-fart-star-color-2',preset.Starcolor2);
            dialog.getProfileSettings().set_string('unicorn-fart-star-color-3',preset.Starcolor3);
            dialog.getProfileSettings().set_string('unicorn-fart-star-color-4',preset.Starcolor4);
            dialog.getProfileSettings().set_string('unicorn-fart-star-color-5',preset.Starcolor5);

          });

          // Add the action to the action group.
          group.add_action(action);
        });

        // Assign the populated menu to the preset button.
        dialog.getBuilder()
          .get_object('unicorn-fart-preset-button')
          .set_menu_model(menu);

        // Insert the action group into the root widget for handling the presets.
        const root = widget.get_root();
        root.insert_action_group(groupName, group);
      });
  }
}