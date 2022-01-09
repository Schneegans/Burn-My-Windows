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

const FirePage     = Me.imports.src.prefs.FirePage.FirePage;
const MatrixPage   = Me.imports.src.prefs.MatrixPage.MatrixPage;
const TVEffectPage = Me.imports.src.prefs.TVEffectPage.TVEffectPage;
const TRexPage     = Me.imports.src.prefs.TRexPage.TRexPage;
const GeneralPage  = Me.imports.src.prefs.GeneralPage.GeneralPage;

//////////////////////////////////////////////////////////////////////////////////////////
// For now, the preferences dialog of this extension is very simple. In the future, if  //
// we might consider to improve its layout...                                           //
//////////////////////////////////////////////////////////////////////////////////////////

const EFFECT_TYPES = [FirePage, MatrixPage, TVEffectPage, TRexPage];

var PreferencesDialog = class PreferencesDialog {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {
    // Load all of our resources.
    this._resources = Gio.Resource.load(Me.path + '/resources/burn-my-windows.gresource');
    Gio.resources_register(this._resources);

    // Store a reference to the settings object.
    this._settings = ExtensionUtils.getSettings();

    // Load the user interface file.
    this._builder = new Gtk.Builder();
    this._builder.add_from_resource(`/ui/common/main-menu.ui`);
    this._builder.add_from_resource(`/ui/${utils.isGTK4() ? 'gtk4' : 'gtk3'}/prefs.ui`);

    this._generalPAge = new GeneralPage(this._settings, this._builder);

    this._effects = [];
    EFFECT_TYPES.forEach(Type => {
      const [minMajor, minMinor] = Type.getMinShellVersion();
      if (utils.shellVersionIsAtLeast(minMajor, minMinor)) {
        this._effects.push(new Type(this._settings, this._builder));
      }
    });

    // This is our top-level widget which we will return later.
    this._widget = this._builder.get_object('settings-widget');

    // Some things can only be done once the widget is shown as we do not have access to
    // the toplevel widget before.
    this._widget.connect('realize', (widget) => {
      const window = utils.isGTK4() ? widget.get_root() : widget.get_toplevel();

      // Show the version number in the title bar.
      window.set_title(`Burn-My-Windows ${Me.metadata.version}`);

      // Add the main menu to the title bar.
      {
        // Add the menu button to the title bar.
        const menu = this._builder.get_object('menu-button');
        window.get_titlebar().pack_end(menu);

        // Populate the menu with actions.
        const group = Gio.SimpleActionGroup.new();
        window.insert_action_group('prefs', group);

        const addAction = (name, uri) => {
          const action = Gio.SimpleAction.new(name, null);
          action.connect('activate', () => Gtk.show_uri(null, uri, Gdk.CURRENT_TIME));
          group.add_action(action);
        };

        // clang-format off
        addAction('homepage',      'https://github.com/Schneegans/Burn-My-Windows');
        addAction('changelog',     'https://github.com/Schneegans/Burn-My-Windows/blob/main/docs/changelog.md');
        addAction('bugs',          'https://github.com/Schneegans/Burn-My-Windows/issues');
        addAction('donate-paypal', 'https://www.paypal.com/donate/?hosted_button_id=3F7UFL8KLVPXE');
        addAction('donate-github', 'https://github.com/sponsors/Schneegans');
        // clang-format on
      }

      // Populate the close-effects drop-down menu.
      {
        const group = Gio.SimpleActionGroup.new();
        window.insert_action_group('close-effects', group);

        const menu = this._builder.get_object('close-effect-menu');

        this._effects.forEach(effect => {
          const prefix = effect.constructor.getSettingsPrefix();
          const label  = effect.constructor.getLabel();

          const action = this._settings.create_action(`${prefix}-close-effect`);
          group.add_action(action);

          menu.append_item(
              Gio.MenuItem.new(label, `close-effects.${prefix}-close-effect`));
        });
      }
    });

    // As we do not have something like a destructor, we just listen for the destroy
    // signal of our main widget.
    this._widget.connect('destroy', () => {
      // Unregister our resources.
      Gio.resources_unregister(this._resources);
    });

    // Show the widgets on GTK3.
    if (!utils.isGTK4()) {
      this._widget.show_all();
    }
  }

  // -------------------------------------------------------------------- public interface

  // Returns the widget used for the settings of this extension.
  getWidget() {
    return this._widget;
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
