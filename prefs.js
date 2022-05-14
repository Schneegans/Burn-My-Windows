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

const {Gio, Gtk, Gdk, GLib, GObject} = imports.gi;
const ByteArray                      = imports.byteArray;

// libadwaita is available starting with GNOME Shell 42.
let Adw = null;
try {
  Adw = imports.gi.Adw;
} catch (e) {
  // Nothing to do.
}

const _ = imports.gettext.domain('burn-my-windows').gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;

// This template widget class is defined at the bottom of this file.
var BurnMyWindowsEffectPage = null;

//////////////////////////////////////////////////////////////////////////////////////////
// The preferences dialog is organized in pages, each of which is loaded from a         //
// separate ui file. There's one page with general options, all other paged are loaded  //
// from the respective effects.                                                         //
//////////////////////////////////////////////////////////////////////////////////////////

var PreferencesDialog = class PreferencesDialog {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {

    // New effects must be registered here and in extension.js.
    this._ALL_EFFECTS = [
      new Me.imports.src.Apparition.Apparition(),
      new Me.imports.src.BrokenGlass.BrokenGlass(),
      new Me.imports.src.EnergizeA.EnergizeA(),
      new Me.imports.src.EnergizeB.EnergizeB(),
      new Me.imports.src.Fire.Fire(),
      new Me.imports.src.Hexagon.Hexagon(),
      new Me.imports.src.Matrix.Matrix(),
      new Me.imports.src.SnapOfDisintegration.SnapOfDisintegration(),
      new Me.imports.src.TRexAttack.TRexAttack(),
      new Me.imports.src.TVEffect.TVEffect(),
      new Me.imports.src.Wisps.Wisps(),
    ];

    // Load all of our resources.
    this._resources = Gio.Resource.load(Me.path + '/resources/burn-my-windows.gresource');
    Gio.resources_register(this._resources);

    // Load the CSS file for the settings dialog.
    const styleProvider = Gtk.CssProvider.new();
    styleProvider.load_from_resource('/css/gtk.css');
    if (utils.isGTK4()) {
      Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), styleProvider,
                                                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    } else {
      Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), styleProvider,
                                               Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }

    // Make sure custom icons are found.
    if (utils.isGTK4()) {
      Gtk.IconTheme.get_for_display(Gdk.Display.get_default()).add_resource_path('/img');
    } else {
      Gtk.IconTheme.get_default().add_resource_path('/img');
    }

    // Register the template widgets used in the settings dialog.
    this._registerCustomClasses();

    // Store a reference to the settings object.
    this._settings = ExtensionUtils.getSettings();

    // Load the general user interface files.
    this._builder = new Gtk.Builder();
    this._builder.add_from_resource(`/ui/common/main-menu.ui`);
    this._builder.add_from_resource(`/ui/${utils.getGTKString()}/prefs.ui`);

    // Bind general options properties.
    this.bindSwitch('destroy-dialogs');


    // Starting with GNOME Shell 42, the settings dialog uses libadwaita (at least most of
    // the time - it seems that pop!_OS does not support libadwaita even on GNOME 42). We
    // have to use a different layout, as the stack sidebar looks pretty ugly with the
    // included Adw.Clamp...
    if (Adw && utils.shellVersionIsAtLeast(42, 'beta')) {

      // This is our top-level widget which we will return later.
      this._widget = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});

      // Add the general options page to the settings dialog.
      const generalPrefs = this._builder.get_object('general-prefs');
      this.gtkBoxAppend(this._widget, generalPrefs);

      // Then add a preferences group with action rows to open the effect subpages.
      const group = new Adw.PreferencesGroup({title: _('Effect Options')});
      this.gtkBoxAppend(this._widget, group);

      this._ALL_EFFECTS.forEach(effect => {
        const [minMajor, minMinor] = effect.getMinShellVersion();
        if (utils.shellVersionIsAtLeast(minMajor, minMinor)) {

          const row = new Adw.ActionRow({title: effect.getLabel(), activatable: true});
          row.add_suffix(new Gtk.Image({icon_name: 'go-next-symbolic'}));

          // Open a subpage with the effect's settings.
          row.connect('activated', () => {
            const page         = new BurnMyWindowsEffectPage(effect, this);
            page.valign        = Gtk.Align.CENTER;
            page.margin_top    = 10;
            page.margin_bottom = 10;
            page.margin_start  = 10;
            page.margin_end    = 10;

            // Add the effect's preferences (if any).
            const preferences = effect.getPreferences(this);
            if (preferences) {
              this.gtkBoxAppend(page, preferences);
            }

            // Add a button for back navigation.
            const backButton = new Gtk.Button({
              halign: Gtk.Align.CENTER,
              label: _('Go Back'),
            });
            backButton.add_css_class('suggested-action');
            backButton.add_css_class('pill-button');
            backButton.connect('clicked', () => {
              row.get_root().close_subpage();
            });

            this.gtkBoxAppend(page, backButton);

            // Wrap the preferences group in an Adw.Clamp.
            const clamp = new Adw.Clamp({
              child: page,
              maximum_size: 600,
              tightening_threshold: 400,
            });

            // Open the subpage on click.
            row.get_root().present_subpage(clamp);
          });

          group.add(row);
        }
      });

    }
    // On older GNOME versions, we use a StackSidebar.
    else {

      // This is our top-level widget which we will return later.
      this._widget = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
      });

      const stack = new Gtk.Stack({
        transition_type: Gtk.StackTransitionType.SLIDE_UP_DOWN,
      });

      // Add the general options page.
      const generalPage        = this._builder.get_object('general-prefs');
      generalPage.margin_start = 60;
      generalPage.margin_end   = 60;
      stack.add_titled(generalPage, 'general', _('General Options'));

      this.gtkBoxAppend(this._widget, new Gtk.StackSidebar({stack: stack}));
      this.gtkBoxAppend(this._widget, stack);

      // Add all other effect pages.
      this._ALL_EFFECTS.forEach(effect => {
        const [minMajor, minMinor] = effect.getMinShellVersion();
        if (utils.shellVersionIsAtLeast(minMajor, minMinor)) {

          const page         = new BurnMyWindowsEffectPage(effect, this);
          page.margin_start  = 60;
          page.margin_end    = 60;
          page.margin_top    = 60;
          page.margin_bottom = 60;

          // Add the effect's preferences (if any).
          const preferences = effect.getPreferences(this);
          if (preferences) {
            this.gtkBoxAppend(page, preferences);
          }

          stack.add_titled(page, effect.getNick(), effect.getLabel());
        }
      });
    }

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

        // Starting with GNOME Shell 42, we have to hack our way through the widget tree
        // of the Adw.PreferencesWindow...
        if (Adw && utils.shellVersionIsAtLeast(42, 'beta')) {
          const header = this._findWidgetByType(window.get_content(), Adw.HeaderBar);
          header.pack_end(menu);

          // Allow closing of the sub pages.
          window.can_navigate_back = true;
        } else {
          window.get_titlebar().pack_end(menu);
        }

        // Populate the menu with actions.
        const group = Gio.SimpleActionGroup.new();
        window.insert_action_group('prefs', group);

        const addURIAction = (name, uri) => {
          const action = Gio.SimpleAction.new(name, null);
          action.connect('activate', () => Gtk.show_uri(null, uri, Gdk.CURRENT_TIME));
          group.add_action(action);
        };

        // clang-format off
        addURIAction('homepage',      'https://github.com/Schneegans/Burn-My-Windows');
        addURIAction('changelog',     'https://github.com/Schneegans/Burn-My-Windows/blob/main/docs/changelog.md');
        addURIAction('bugs',          'https://github.com/Schneegans/Burn-My-Windows/issues');
        addURIAction('new-effect',    'https://github.com/Schneegans/Burn-My-Windows/blob/main/docs/how-to-create-new-effects.md');
        addURIAction('translate',     'https://hosted.weblate.org/engage/burn-my-windows/');
        addURIAction('donate-paypal', 'https://www.paypal.com/donate/?hosted_button_id=3F7UFL8KLVPXE');
        addURIAction('donate-github', 'https://github.com/sponsors/Schneegans');
        // clang-format on

        // Add the about dialog.
        const aboutAction = Gio.SimpleAction.new('about', null);
        aboutAction.connect('activate', () => {
          // The JSON report format from weblate is a bit weird. Here we extract all
          // unique names from the translation report.
          const translators = new Set();
          this._getJSONResource('/credits/translators.json').forEach(i => {
            for (const j of Object.values(i)) {
              j.forEach(k => translators.add(k[1]));
            }
          });

          const sponsors = this._getJSONResource('/credits/sponsors.json');

          const dialog = new Gtk.AboutDialog({transient_for: window, modal: true});
          dialog.set_logo_icon_name('burn-my-windows-symbolic');
          dialog.set_program_name(`Burn-My-Windows ${Me.metadata.version}`);
          dialog.set_website('https://github.com/Schneegans/Burn-My-Windows');
          dialog.set_authors(['Simon Schneegans']);
          dialog.set_copyright('© 2022 Simon Schneegans');
          dialog.set_translator_credits([...translators].join('\n'));
          if (sponsors.gold.length > 0) {
            dialog.add_credit_section(_('Gold Sponsors'), sponsors.gold);
          }
          if (sponsors.silver.length > 0) {
            dialog.add_credit_section(_('Silver Sponsors'), sponsors.silver);
          }
          if (sponsors.bronze.length > 0) {
            dialog.add_credit_section(_('Bronze Sponsors'), sponsors.bronze);
          }
          if (sponsors.past.length > 0) {
            dialog.add_credit_section(_('Past Sponsors'), sponsors.past);
          }
          dialog.set_license_type(Gtk.License.GPL_3_0);

          if (utils.isGTK4()) {
            dialog.show();
          } else {
            dialog.show_all();
          }
        });
        group.add_action(aboutAction);
      }

      // Populate the open-effects drop-down menu.
      {
        const menu  = this._builder.get_object('open-effect-menu');
        const group = Gio.SimpleActionGroup.new();
        window.insert_action_group('open-effects', group);

        this._ALL_EFFECTS.forEach(effect => {
          const [minMajor, minMinor] = effect.getMinShellVersion();
          if (utils.shellVersionIsAtLeast(minMajor, minMinor)) {
            const nick       = effect.getNick();
            const label      = effect.getLabel();
            const actionName = nick + '-open-effect';
            const fullName   = 'open-effects.' + actionName;

            const action = this._settings.create_action(actionName);
            group.add_action(action);

            menu.append_item(Gio.MenuItem.new(label, fullName));
          }
        });
      }

      // Populate the close-effects drop-down menu.
      {
        const menu  = this._builder.get_object('close-effect-menu');
        const group = Gio.SimpleActionGroup.new();
        window.insert_action_group('close-effects', group);

        this._ALL_EFFECTS.forEach(effect => {
          const [minMajor, minMinor] = effect.getMinShellVersion();
          if (utils.shellVersionIsAtLeast(minMajor, minMinor)) {
            const nick       = effect.getNick();
            const label      = effect.getLabel();
            const actionName = nick + '-close-effect';
            const fullName   = 'close-effects.' + actionName;

            const action = this._settings.create_action(actionName);
            group.add_action(action);

            menu.append_item(Gio.MenuItem.new(label, fullName));
          }
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

  // Returns the internally used Gtk.Builder. Effects can use this to modify the UI of the
  // preferences dialog.
  getBuilder() {
    return this._builder;
  }

  // Returns a Gio.Settings object for this extension.
  getSettings() {
    return this._settings;
  }

  // Returns the widget used for the settings of this extension.
  getWidget() {
    return this._widget;
  }

  // Connects a Gtk.ComboBox (or anything else which has an 'active-id' property) to a
  // settings key. It also binds the corresponding reset button.
  bindCombobox(settingsKey) {
    this._bind(settingsKey, 'active-id');
  }

  // Connects a Gtk.Adjustment (or anything else which has a 'value' property) to a
  // settings key. It also binds the corresponding reset button.
  bindAdjustment(settingsKey) {
    this._bind(settingsKey, 'value');
  }

  // Connects a Gtk.Switch (or anything else which has an 'active' property) to a settings
  // key. It also binds the corresponding reset button.
  bindSwitch(settingsKey) {
    this._bind(settingsKey, 'active');
  }

  // Colors are stored as strings like 'rgb(1, 0.5, 0)'. As Gio.Settings.bind_with_mapping
  // is not available yet, we need to do the color conversion manually. It also binds the
  // corresponding reset button.
  bindColorButton(settingsKey) {

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

  // ----------------------------------------------------------------- GTK3 / GTK4 helpers

  // Appends the given child widget to the given Gtk.Box.
  gtkBoxAppend(box, child) {
    if (utils.isGTK4()) {
      box.append(child);
    } else {
      box.pack_start(child, false, false, 0);
    }
  }

  // ----------------------------------------------------------------------- private stuff

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

  // Connects any widget's property to a settings key. The widget must have the same ID as
  // the settings key. It also binds the corresponding reset button.
  _bind(settingsKey, property) {
    const object = this._builder.get_object(settingsKey);

    if (object) {
      this._settings.bind(settingsKey, object, property, Gio.SettingsBindFlags.DEFAULT);
    }

    this._bindResetButton(settingsKey);
  }

  // Reads the contents of a JSON file contained in the global resources archive. The data
  // is parsed and returned as a JavaScript object / array.
  _getJSONResource(path) {
    const data   = Gio.resources_lookup_data(path, 0);
    const string = ByteArray.toString(ByteArray.fromGBytes(data));
    return JSON.parse(string);
  }

  // This traverses the widget tree below the given parent recursively and returns the
  // first widget of the given type.
  _findWidgetByType(parent, type) {
    for (const child of [...parent]) {
      if (child instanceof type) return child;

      const match = this._findWidgetByType(child, type);
      if (match) return match;
    }

    return null;
  }

  // Initializes template widgets used by the preferences dialog.
  _registerCustomClasses() {

    // Each effect page is based on a template widget. This template contains the title
    // and the preview button.
    if (GObject.type_from_name('BurnMyWindowsEffectPage') == null) {
      BurnMyWindowsEffectPage = GObject.registerClass(
        {
          GTypeName: 'BurnMyWindowsEffectPage',
          Template: `resource:///ui/${utils.getGTKString()}/effectPage.ui`,
          InternalChildren: ['label', 'button'],
        },
        class BurnMyWindowsEffectPage extends Gtk.Box {  // ------------------------------
          _init(effect, dialog) {
            super._init();

            // Set the effect's name as label.
            this._label.label = effect.getLabel();

            // Open the preview window once the preview button is clicked.
            this._button.connect('clicked', () => {
              // Set the to-be-previewed effect.
              dialog.getSettings().set_string('open-preview-effect', effect.getNick());
              dialog.getSettings().set_string('close-preview-effect', effect.getNick());

              // Make sure that the window.show() firther below "sees" this change.
              Gio.Settings.sync();

              // Create the preview-window.
              const window = new Gtk.Window({
                // Translators: %s will be replaced by the effect's name.
                title: _('Preview for %s').replace('%s', effect.getLabel()),
                default_width: 800,
                default_height: 450,
                modal: true,
                transient_for: utils.isGTK4() ? this._button.get_root() :
                                                this._button.get_toplevel()
              });

              // Add a header bar to the window.
              if (utils.isGTK4()) {
                const header = Gtk.HeaderBar.new();
                window.set_titlebar(header);
              }

              const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                spacing: 10,
                margin_start: 50,
                margin_end: 50
              });

              const label = Gtk.Label.new(_('Close this Window to Preview the Effect!'));
              label.wrap  = true;
              label.justify = Gtk.Justification.CENTER;
              label.get_style_context().add_class('large-title');

              const image = new Gtk.Image({
                icon_name: 'burn-my-windows-symbolic',
                pixel_size: 128,
              });

              dialog.gtkBoxAppend(box, image);
              dialog.gtkBoxAppend(box, label);

              if (utils.isGTK4()) {
                window.set_child(box);
                window.show();
              } else {
                window.add(box);
                window.show_all();
              }
            });
          }
        });
    }
  }
}

// This is used for setting up the translations.
function init() {
  ExtensionUtils.initTranslations();
}

// This function is called when the preferences window is created to build and return a
// Gtk widget. We create a new instance of the PreferencesDialog class each time this
// method is called. This way we can actually open multiple settings windows and interact
// with all of them properly.
function buildPrefsWidget() {
  var dialog = new PreferencesDialog();
  return dialog.getWidget();
}
