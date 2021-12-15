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
const utils          = Me.imports.utils;

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
    this._builder.add_from_resource(`/ui/settings.ui`);

    // This is our top-level widget which we will return later.
    this._widget = this._builder.get_object('settings-widget');

    // Store a reference to the settings object.
    this._settings = ExtensionUtils.getSettings();

    // Bind all properties.
    this._bindAdjustment('destroy-animation-time');
    this._bindColorButton('fire-color-1');
    this._bindColorButton('fire-color-2');
    this._bindColorButton('fire-color-3');
    this._bindColorButton('fire-color-4');
    this._bindColorButton('fire-color-5');

    // The fire-gradient-reset button needs to by bound explicitly.
    this._builder.get_object('reset-fire-colors').connect('clicked', () => {
      this._settings.reset('fire-color-1');
      this._settings.reset('fire-color-2');
      this._settings.reset('fire-color-3');
      this._settings.reset('fire-color-4');
      this._settings.reset('fire-color-5');
    });

    // As we do not have something like a destructor, we just listen for the destroy
    // signal of our main widget.
    this._widget.connect('destroy', () => {
      // Unregister our resources.
      Gio.resources_unregister(this._resources);
    });
  }

  // -------------------------------------------------------------------- public interface

  // Returns the widget used for the settings of this extension.
  getWidget() {
    return this._widget;
  }

  // ----------------------------------------------------------------------- private stuff

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
  // is not available yet, we need to do the color conversion manually.
  _bindColorButton(settingsKey) {

    const button = this._builder.get_object(settingsKey);

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

  // Connects any widget's property to a settings key. The widget must have the same ID as
  // the settings key. It also binds the corresponding reset button.
  _bind(settingsKey, property) {
    this._settings.bind(
        settingsKey, this._builder.get_object(settingsKey), property,
        Gio.SettingsBindFlags.DEFAULT);

    this._builder.get_object('reset-' + settingsKey)?.connect('clicked', () => {
      this._settings.reset(settingsKey);
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
