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

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import Gio from 'gi://Gio';

import * as utils from '../utils.js';

// We import some modules only in the Shell process as they are not available in the
// preferences process. They are used only in the creator function of the ShaderFactory
// which is only called within GNOME Shell's process.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');
const Clutter       = await utils.importInShellOnly('gi://Clutter');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// This effect is a homage to the good old Compiz days. However, it is implemented      //
// quite differently. While Compiz used a particle system, this effect uses a noise     //
// shader. The noise is moved vertically over time and mapped to a configurable color   //
// gradient. It is faded to transparency towards the edges of the window. In addition,  //
// there are a couple of moving gradients which fade-in or fade-out the fire effect.    //
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
      // Store all uniform locations.
      shader._uGradient = [
        shader.get_uniform_location('uGradient1'),
        shader.get_uniform_location('uGradient2'),
        shader.get_uniform_location('uGradient3'),
        shader.get_uniform_location('uGradient4'),
        shader.get_uniform_location('uGradient5'),
      ];

      shader._u3DNoise       = shader.get_uniform_location('u3DNoise');
      shader._uScale         = shader.get_uniform_location('uScale');
      shader._uMovementSpeed = shader.get_uniform_location('uMovementSpeed');

      // And update all uniforms at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        for (let i = 1; i <= 5; i++) {
          shader.set_uniform_float(
            shader._uGradient[i - 1], 4,
            utils.parseColor(settings.get_string('fire-color-' + i)));
        }

        // clang-format off
        shader.set_uniform_float(shader._u3DNoise,       1, [settings.get_boolean('fire-3d-noise')]);
        shader.set_uniform_float(shader._uScale,         1, [settings.get_double('fire-scale')]);
        shader.set_uniform_float(shader._uMovementSpeed, 1, [settings.get_double('fire-movement-speed')]);
        // clang-format on
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
  // (e.g. '*-animation-time').
  static getNick() {
    return 'fire';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Fire');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {

    // Bind all properties.
    dialog.bindAdjustment('fire-animation-time');
    dialog.bindAdjustment('fire-movement-speed');
    dialog.bindAdjustment('fire-scale');
    dialog.bindSwitch('fire-3d-noise');
    dialog.bindColorButton('fire-color-1');
    dialog.bindColorButton('fire-color-2');
    dialog.bindColorButton('fire-color-3');
    dialog.bindColorButton('fire-color-4');
    dialog.bindColorButton('fire-color-5');

    // Connect the buttons only once. The bindPreferences can be called multiple times...
    if (!Effect._isConnected) {
      Effect._isConnected = true;

      // The fire-gradient-reset button needs to be bound explicitly.
      dialog.getBuilder().get_object('reset-fire-colors').connect('clicked', () => {
        dialog.getProfileSettings().reset('fire-color-1');
        dialog.getProfileSettings().reset('fire-color-2');
        dialog.getProfileSettings().reset('fire-color-3');
        dialog.getProfileSettings().reset('fire-color-4');
        dialog.getProfileSettings().reset('fire-color-5');
      });

      // Initialize the fire-preset dropdown.
      Effect._createFirePresets(dialog);
    }
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }

  // ----------------------------------------------------------------------- private stuff

  // This populates the preset dropdown menu for the fire options.
  static _createFirePresets(dialog) {
    dialog.getBuilder().get_object('fire-prefs').connect('realize', (widget) => {
      const presets = [
        {
          name: _('Default Fire'),
          scale: 1.0,
          speed: 0.5,
          color1: 'rgba(76, 51, 25, 0.0)',
          color2: 'rgba(180, 55, 30, 0.7)',
          color3: 'rgba(255, 76, 38, 0.9)',
          color4: 'rgba(255, 166, 25, 1)',
          color5: 'rgba(255, 255, 255, 1)'
        },
        {
          name: _('Hell Fire'),
          scale: 1.5,
          speed: 0.2,
          color1: 'rgba(0,0,0,0)',
          color2: 'rgba(103,7,80,0.5)',
          color3: 'rgba(150,0,24,0.9)',
          color4: 'rgb(255,200,0)',
          color5: 'rgba(255, 255, 255, 1)'
        },
        {
          name: _('Dark and Smutty'),
          scale: 1.0,
          speed: 0.5,
          color1: 'rgba(0,0,0,0)',
          color2: 'rgba(36,3,0,0.5)',
          color3: 'rgba(150,0,24,0.9)',
          color4: 'rgb(255,177,21)',
          color5: 'rgb(255,238,166)'
        },
        {
          name: _('Cold Breeze'),
          scale: 1.5,
          speed: -0.1,
          color1: 'rgba(0,110,255,0)',
          color2: 'rgba(30,111,180,0.24)',
          color3: 'rgba(38,181,255,0.54)',
          color4: 'rgba(34,162,255,0.84)',
          color5: 'rgb(97,189,255)'
        },
        {
          name: _('Santa is Coming'),
          scale: 0.4,
          speed: -0.5,
          color1: 'rgba(0,110,255,0)',
          color2: 'rgba(208,233,255,0.24)',
          color3: 'rgba(207,235,255,0.84)',
          color4: 'rgb(208,243,255)',
          color5: 'rgb(255,255,255)'
        }
      ];

      const menu      = Gio.Menu.new();
      const group     = Gio.SimpleActionGroup.new();
      const groupName = 'presets';

      // Add all presets.
      presets.forEach((preset, i) => {
        const actionName = 'fire' + i;
        menu.append(preset.name, groupName + '.' + actionName);
        let action = Gio.SimpleAction.new(actionName, null);

        // Load the preset on activation.
        action.connect('activate', () => {
          dialog.getProfileSettings().set_double('fire-movement-speed', preset.speed);
          dialog.getProfileSettings().set_double('fire-scale', preset.scale);
          dialog.getProfileSettings().set_string('fire-color-1', preset.color1);
          dialog.getProfileSettings().set_string('fire-color-2', preset.color2);
          dialog.getProfileSettings().set_string('fire-color-3', preset.color3);
          dialog.getProfileSettings().set_string('fire-color-4', preset.color4);
          dialog.getProfileSettings().set_string('fire-color-5', preset.color5);
        });

        group.add_action(action);
      });

      dialog.getBuilder().get_object('fire-preset-button').set_menu_model(menu);

      const root = widget.get_root();
      root.insert_action_group(groupName, group);
    });
  }
}
