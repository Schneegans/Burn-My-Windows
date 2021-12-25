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

const {Gio, Gtk, Gdk} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// For now, the preferences dialog of this extension is very simple. In the future, if  //
// we might consider to improve its layout...                                           //
//////////////////////////////////////////////////////////////////////////////////////////

var PreferencesDialog = class PreferencesDialog {
  // ------------------------------------------------------------ constructor / destructor

  constructor() {
    // Load all of our resources.
    this._resources = Gio.Resource.load(Me.path + '/resources/burn-my-windows.gresource');
    Gio.resources_register(this._resources);

    // Load the user interface file.
    this._builder = new Gtk.Builder();
    this._builder.add_from_resource(`/ui/${utils.gtk4() ? 'gtk4' : 'gtk3'}.ui`);

    // This is our top-level widget which we will return later.
    this._widget = this._builder.get_object('settings-widget');

    // Store a reference to the settings object.
    this._settings = ExtensionUtils.getSettings();

    // Bind all properties.
    this._bindAdjustment('destroy-animation-time');
    this._bindCombobox('close-animation');
    this._bindAdjustment('flame-movement-speed');
    this._bindAdjustment('flame-scale');
    this._bindColorButton('fire-color-1');
    this._bindColorButton('fire-color-2');
    this._bindColorButton('fire-color-3');
    this._bindColorButton('fire-color-4');
    this._bindColorButton('fire-color-5');
    this._bindAdjustment('matrix-scale');
    this._bindAdjustment('matrix-randomness');
    this._bindColorButton('matrix-trail-color');
    this._bindColorButton('matrix-tip-color');

    // The fire-gradient-reset button needs to by bound explicitly.
    this._builder.get_object('reset-fire-colors').connect('clicked', () => {
      this._settings.reset('fire-color-1');
      this._settings.reset('fire-color-2');
      this._settings.reset('fire-color-3');
      this._settings.reset('fire-color-4');
      this._settings.reset('fire-color-5');
    });

    // Initialize the fire-preset dropdown.
    this._createFirePresets();

    // As we do not have something like a destructor, we just listen for the destroy
    // signal of our main widget.
    this._widget.connect('destroy', () => {
      // Unregister our resources.
      Gio.resources_unregister(this._resources);
    });

    // Show the widgets on GTK3.
    if (!utils.gtk4()) {
      this._widget.show_all();
    }
  }

  // -------------------------------------------------------------------- public interface

  // Returns the widget used for the settings of this extension.
  getWidget() {
    return this._widget;
  }

  // ----------------------------------------------------------------------- private stuff

  // Connects a Gtk.ComboBox (or anything else which has an 'active-id' property) to a
  // settings key. It also binds the corresponding reset button.
  _bindCombobox(settingsKey) {
    this._bind(settingsKey, 'active-id');
  }

  // Connects a Gtk.Adjustment (or anything else which has a 'value' property) to a
  // settings key. It also binds the corresponding reset button.
  _bindAdjustment(settingsKey) {
    this._bind(settingsKey, 'value');
  }

  // Connects a Gtk.Switch (or anything else which has an 'active' property) to a settings
  // key. It also binds the corresponding reset button.
  _bindSwitch(settingsKey) {
    this._bind(settingsKey, 'active');
  }

  // Colors are stored as strings like 'rgb(1, 0.5, 0)'. As Gio.Settings.bind_with_mapping
  // is not available yet, we need to do the color conversion manually. It also binds the
  // corresponding reset button.
  _bindColorButton(settingsKey) {

    const button = this._builder.get_object(settingsKey);

    if (button) {

      // Update the settings when the color is modified.
      button.connect('color-set', () => {
        this._settings.set_string(settingsKey, button.get_rgba().to_string());
      });

      // Update the button state when the settings change.
      const settingSignalHandler = () => {
        const rgba = new Gdk.RGBA();
        rgba.parse(this._settings.get_string(settingsKey));
        button.rgba = rgba;
      };

      this._settings.connect('changed::' + settingsKey, settingSignalHandler);

      // Initialize the button with the state in the settings.
      settingSignalHandler();
    }

    this._bindResetButton(settingsKey);
  }

  // Connects any widget's property to a settings key. The widget must have the same ID as
  // the settings key. It also binds the corresponding reset button.
  _bind(settingsKey, property) {
    const object = this._builder.get_object(settingsKey);

    if (object) {
      this._settings.bind(settingsKey, object, property, Gio.SettingsBindFlags.DEFAULT);
    }

    this._bindResetButton(settingsKey);
  }

  // Searches for a reset button for the given settings key and make it reset the settings
  // key when clicked.
  _bindResetButton(settingsKey) {
    const resetButton = this._builder.get_object('reset-' + settingsKey);
    if (resetButton) {
      resetButton.connect('clicked', () => {
        this._settings.reset(settingsKey);
      });
    }
  }

  // This populates the preset dropdown menu for the fire options.
  _createFirePresets() {
    this._widget.connect('realize', (widget) => {
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
          this._settings.set_double('flame-movement-speed', preset.speed);
          this._settings.set_double('flame-scale', preset.scale);
          this._settings.set_string('fire-color-1', preset.color1);
          this._settings.set_string('fire-color-2', preset.color2);
          this._settings.set_string('fire-color-3', preset.color3);
          this._settings.set_string('fire-color-4', preset.color4);
          this._settings.set_string('fire-color-5', preset.color5);
        });

        group.add_action(action);
      });

      this._builder.get_object('fire-preset-button').set_menu_model(menu);

      const root = utils.gtk4() ? widget.get_root() : widget.get_toplevel();
      root.insert_action_group(groupName, group);
    });
  }
}

// Nothing to do for now...
function init() {}

// This function is called when the preferences window is created to build and return a
// Gtk widget. We create a new instance of the PreferencesDialog class each time this
// method is called. This way we can actually open multiple settings windows and interact
// with all of them properly.
function buildPrefsWidget() {
  var dialog = new PreferencesDialog();
  return dialog.getWidget();
}
