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

const {Gio} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

var FirePage = class FirePage {

  // ---------------------------------------------------------------------- static methods

  static getMinShellVersion() {
    return [3, 36];
  }

  static getSettingsPrefix() {
    return 'fire';
  }

  static getLabel() {
    return 'Fire';
  }

  static initPreferences(dialog) {

    dialog.getBuilder().add_from_resource(
        `/ui/${utils.isGTK4() ? 'gtk4' : 'gtk3'}/firePage.ui`);

    // Bind all properties.
    dialog.bindAdjustment('fire-animation-time');
    dialog.bindAdjustment('flame-movement-speed');
    dialog.bindAdjustment('flame-scale');
    dialog.bindSwitch('flame-3d-noise');
    dialog.bindColorButton('fire-color-1');
    dialog.bindColorButton('fire-color-2');
    dialog.bindColorButton('fire-color-3');
    dialog.bindColorButton('fire-color-4');
    dialog.bindColorButton('fire-color-5');

    // The fire-gradient-reset button needs to be bound explicitly.
    dialog.getBuilder().get_object('reset-fire-colors').connect('clicked', () => {
      dialog.getSettings().reset('fire-color-1');
      dialog.getSettings().reset('fire-color-2');
      dialog.getSettings().reset('fire-color-3');
      dialog.getSettings().reset('fire-color-4');
      dialog.getSettings().reset('fire-color-5');
    });

    // Initialize the fire-preset dropdown.
    FirePage._createFirePresets(dialog);

    const stack = dialog.getBuilder().get_object('main-stack');
    stack.add_titled(dialog.getBuilder().get_object('fire-prefs'), 'fire', 'Fire');
  }

  // ----------------------------------------------------------------------- private stuff

  // This populates the preset dropdown menu for the fire options.
  static _createFirePresets(dialog) {
    dialog.getBuilder().get_object('settings-widget').connect('realize', (widget) => {
      const presets = [
        {
          name: 'Default Fire',
          scale: 1.0,
          speed: 0.5,
          color1: 'rgba(76, 51, 25, 0.0)',
          color2: 'rgba(180, 55, 30, 0.7)',
          color3: 'rgba(255, 76, 38, 0.9)',
          color4: 'rgba(255, 166, 25, 1)',
          color5: 'rgba(255, 255, 255, 1)'
        },
        {
          name: 'Hell Fire',
          scale: 1.5,
          speed: 0.2,
          color1: 'rgba(0,0,0,0)',
          color2: 'rgba(103,7,80,0.5)',
          color3: 'rgba(150,0,24,0.9)',
          color4: 'rgb(255,200,0)',
          color5: 'rgba(255, 255, 255, 1)'
        },
        {
          name: 'Dark and Smutty',
          scale: 1.0,
          speed: 0.5,
          color1: 'rgba(0,0,0,0)',
          color2: 'rgba(36,3,0,0.5)',
          color3: 'rgba(150,0,24,0.9)',
          color4: 'rgb(255,177,21)',
          color5: 'rgb(255,238,166)'
        },
        {
          name: 'Cold Breeze',
          scale: 1.5,
          speed: -0.1,
          color1: 'rgba(0,110,255,0)',
          color2: 'rgba(30,111,180,0.24)',
          color3: 'rgba(38,181,255,0.54)',
          color4: 'rgba(34,162,255,0.84)',
          color5: 'rgb(97,189,255)'
        },
        {
          name: 'Santa is Coming',
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
          dialog.getSettings().set_double('flame-movement-speed', preset.speed);
          dialog.getSettings().set_double('flame-scale', preset.scale);
          dialog.getSettings().set_string('fire-color-1', preset.color1);
          dialog.getSettings().set_string('fire-color-2', preset.color2);
          dialog.getSettings().set_string('fire-color-3', preset.color3);
          dialog.getSettings().set_string('fire-color-4', preset.color4);
          dialog.getSettings().set_string('fire-color-5', preset.color5);
        });

        group.add_action(action);
      });

      dialog.getBuilder().get_object('fire-preset-button').set_menu_model(menu);

      const root = utils.isGTK4() ? widget.get_root() : widget.get_toplevel();
      root.insert_action_group(groupName, group);
    });
  }
}