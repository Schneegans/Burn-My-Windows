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

const {Gio, Gtk, Gdk, GLib, GObject} = imports.gi;

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
const ProfileManager = Me.imports.src.ProfileManager.ProfileManager;

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
      new Me.imports.src.effects.Apparition.Apparition(),
      new Me.imports.src.effects.BrokenGlass.BrokenGlass(),
      new Me.imports.src.effects.Doom.Doom(),
      new Me.imports.src.effects.EnergizeA.EnergizeA(),
      new Me.imports.src.effects.EnergizeB.EnergizeB(),
      new Me.imports.src.effects.Fire.Fire(),
      new Me.imports.src.effects.Glide.Glide(),
      new Me.imports.src.effects.Glitch.Glitch(),
      new Me.imports.src.effects.Hexagon.Hexagon(),
      new Me.imports.src.effects.Incinerate.Incinerate(),
      new Me.imports.src.effects.Matrix.Matrix(),
      new Me.imports.src.effects.Pixelate.Pixelate(),
      new Me.imports.src.effects.PixelWheel.PixelWheel(),
      new Me.imports.src.effects.PixelWipe.PixelWipe(),
      new Me.imports.src.effects.Portal.Portal(),
      new Me.imports.src.effects.SnapOfDisintegration.SnapOfDisintegration(),
      new Me.imports.src.effects.TRexAttack.TRexAttack(),
      new Me.imports.src.effects.TVEffect.TVEffect(),
      new Me.imports.src.effects.TVGlitch.TVGlitch(),
      new Me.imports.src.effects.Wisps.Wisps(),
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

    // Load the general user interface files.
    this._builder = new Gtk.Builder();
    this._builder.add_from_resource(`/ui/common/menus.ui`);
    this._builder.add_from_resource(`/ui/${utils.getUIDir()}/prefs.ui`);

    // Store a reference to the general settings object.
    this._settings = ExtensionUtils.getSettings();

    // This tracks all available effect profiles.
    this._profileManager = new ProfileManager();

    // This is used to track all connections to properties of the current effect profile.
    // Whenever the current effect profile changes, all connections are disconnected.
    this._profileConnections = [];

    // Load the current effect profile. If there is none, we create a default profile.
    this._settings.connect('changed::active-profile', () => {
      this._loadActiveProfile();
    });

    // Check whether the power profiles daemon is available - if not, we hide the
    // corresponding settings row.
    let hasPowerProfiles = false;
    try {
      const PowerProfilesProxy = Gio.DBusProxy.makeProxyWrapper(
        utils.getStringResource('/interfaces/net.hadess.PowerProfiles.xml'));
      let powerProfilesProxy = new PowerProfilesProxy(
        Gio.DBus.system, 'net.hadess.PowerProfiles', '/net/hadess/PowerProfiles');

      hasPowerProfiles = powerProfilesProxy.get_name_owner() != null;
    } catch (e) {
      // Maybe the service is masked...
    }

    this._builder.get_object('profile-power-profile').set_visible(hasPowerProfiles);

    // The global color scheme is only available starting with GNOME Shell 42. We hide the
    // corresponding settings row on older versions.
    this._builder.get_object('profile-color-scheme')
      .set_visible(utils.shellVersionIsAtLeast(42, 0));

    this._builder.get_object('profile-choose-app-button').connect('clicked', () => {
      Gio.DBus.session.call('org.gnome.Shell',
                            '/org/gnome/shell/extensions/BurnMyWindows',
                            'org.gnome.shell.extensions.BurnMyWindows', 'PickWindow',
                            null, null, Gio.DBusCallFlags.NO_AUTO_START, -1, null, null);
    });

    this._dbusConnection = Gio.DBus.session.signal_subscribe(
      'org.gnome.Shell', 'org.gnome.shell.extensions.BurnMyWindows', 'WindowPicked',
      '/org/gnome/shell/extensions/BurnMyWindows', null, Gio.DBusSignalFlags.NONE,
      (conn, sender, obj_path, iface, signal, params) => {
        const val = params.get_child_value(0).get_string()[0];

        if (val != 'window-not-found') {
          this._builder.get_object('profile-app').text = val;
        }
      });

    // Starting with GNOME Shell 42, the settings dialog uses libadwaita. We use this to
    // create a completely different layout for the settings dialog.
    if (utils.isADW()) {

      // This is our top-level widget which we will return later.
      this._widget = this._builder.get_object('general-prefs');

      // Then add a preferences group for the effect expander rows.
      const group = this._builder.get_object('effects-group');

      // This stores all expander rows for the effects. We use this to implement the
      // accordion-functionality of the effect settings.
      this._effectRows = [];

      // Now add all the rows.
      this._ALL_EFFECTS.forEach(effect => {
        const [minMajor, minMinor] = effect.getMinShellVersion();
        if (utils.shellVersionIsAtLeast(minMajor, minMinor)) {

          const uiFile     = `/ui/${utils.getUIDir()}/${effect.getNick()}.ui`;
          const [hasPrefs] = Gio.resources_get_info(uiFile, 0);

          let row;
          if (hasPrefs) {
            // Add the settings page to the builder.
            this._builder.add_from_resource(uiFile);

            // Add the effect's preferences (if any).
            row = this._builder.get_object(`${effect.getNick()}-prefs`);
          } else {
            row = Adw.ActionRow.new();
          }

          // On older versions of Adw (e.g. on GNOME Shell <43), the set_use_markup() does
          // not yet exist.
          if (row.set_use_markup) {
            row.set_title('<b>' + effect.getLabel() + '</b>');
            row.set_use_markup(true);
          } else {
            row.set_title(effect.getLabel());
          }

          // Un-expand any previously expanded effect row. This way we ensure that there
          // is only one expanded row at any time.
          if (hasPrefs) {
            row.connect('notify::expanded', currentRow => {
              if (currentRow.get_expanded()) {
                this._effectRows.forEach(row => {
                  if (row != currentRow && row.set_expanded) {
                    row.set_expanded(false);
                  }
                });
              }
            });
          }

          // The preview button.
          const previewButton = Gtk.Button.new_from_icon_name('bmw-preview-symbolic');
          previewButton.add_css_class('circular');
          previewButton.add_css_class('flat');
          previewButton.set_tooltip_text(_('Preview this effect'));
          previewButton.set_valign(Gtk.Align.CENTER);
          row.add_action(previewButton);

          previewButton.connect('clicked', () => {
            this._previewEffect(effect);
          });

          // Now add the toggle button for enabling and disabling the effect.
          const button = Gtk.Switch.new();
          button.set_tooltip_text(_('Use this effect'));
          button.set_valign(Gtk.Align.CENTER);
          this._builder.expose_object(`${effect.getNick()}-enable-effect`, button);

          row.add_prefix(button);
          group.add(row);

          this._effectRows.push(row);
        }
      });
    }
    // On older GNOME versions, we use a StackSidebar. The code below works on GTK3 and
    // GTK4.
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

          const uiFile     = `/ui/${utils.getUIDir()}/${effect.getNick()}.ui`;
          const [hasPrefs] = Gio.resources_get_info(uiFile);
          if (hasPrefs) {

            // Add the settings page to the builder.
            this._builder.add_from_resource(uiFile);

            // Add the effect's preferences (if any).
            const prefs = this._builder.get_object(`${effect.getNick()}-prefs`);
            if (prefs) {
              this.gtkBoxAppend(page, prefs);
            }
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

      this._loadActiveProfile();
      this._updateProfileMenu();

      // Populate the menu with actions.
      const group = Gio.SimpleActionGroup.new();
      window.insert_action_group('prefs', group);

      // Add the main menu to the title bar.
      {
        // Add the menu button to the title bar.
        const menu = this._builder.get_object('menu-button');

        // Starting with GNOME Shell 42, we have to hack our way through the widget tree
        // of the Adw.PreferencesWindow...
        if (Adw && utils.shellVersionIsAtLeast(42, 'beta')) {
          const header = this._findWidgetByType(window.get_content(), Adw.HeaderBar);
          header.pack_start(menu);
          header.set_title_widget(this._builder.get_object('profile-button'));

          const flap     = this._builder.get_object('profile-editor-flap');
          const clamp    = this._findWidgetByType(window.get_content(), Adw.Clamp);
          const viewport = clamp.get_parent();
          viewport.get_parent().set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
          viewport.set_child(flap);

          const scrolledWindow = Gtk.ScrolledWindow.new();
          scrolledWindow.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
          scrolledWindow.set_propagate_natural_height(true);
          scrolledWindow.set_vexpand(true);
          scrolledWindow.set_child(clamp);

          flap.set_content(scrolledWindow);

        } else {
          window.get_titlebar().pack_start(menu);
        }

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
          let dialog;

          // We try to use the special Adw.AboutWindow if it is available.
          if (utils.isADW() && Adw.AboutWindow) {
            let formatSponsors = (sponsors) => {
              return sponsors.map(s => {
                if (s.url == '')
                  return s.name;
                else
                  return `${s.name} ${s.url}`;
              });
            };

            dialog = new Adw.AboutWindow({transient_for: window, modal: true});
            dialog.set_application_icon('burn-my-windows-symbolic');
            dialog.set_application_name('Burn-My-Windows');
            dialog.set_version(`${Me.metadata.version}`);
            dialog.set_developer_name('Simon Schneegans');
            dialog.set_issue_url('https://github.com/Schneegans/Burn-My-Windows/issues');
            if (sponsors.gold.length > 0) {
              dialog.add_credit_section(_('Gold Sponsors'),
                                        formatSponsors(sponsors.gold));
            }
            if (sponsors.silver.length > 0) {
              dialog.add_credit_section(_('Silver Sponsors'),
                                        formatSponsors(sponsors.silver));
            }
            if (sponsors.bronze.length > 0) {
              dialog.add_credit_section(_('Bronze Sponsors'),
                                        formatSponsors(sponsors.bronze));
            }
            if (sponsors.past.length > 0) {
              dialog.add_credit_section(_('Past Sponsors'),
                                        formatSponsors(sponsors.past));
            }

          } else {

            let formatSponsors = (sponsors) => {
              return sponsors.map(s => {
                if (s.url == '')
                  return s.name;
                else
                  return `<a href="${s.url}">${s.name}</a>`;
              });
            };

            dialog = new Gtk.AboutDialog({transient_for: window, modal: true});
            dialog.set_logo_icon_name('burn-my-windows-symbolic');
            dialog.set_program_name(`Burn-My-Windows ${Me.metadata.version}`);
            dialog.set_authors(['Simon Schneegans']);
            if (sponsors.gold.length > 0) {
              dialog.add_credit_section(_('Gold Sponsors'),
                                        formatSponsors(sponsors.gold));
            }
            if (sponsors.silver.length > 0) {
              dialog.add_credit_section(_('Silver Sponsors'),
                                        formatSponsors(sponsors.silver));
            }
            if (sponsors.bronze.length > 0) {
              dialog.add_credit_section(_('Bronze Sponsors'),
                                        formatSponsors(sponsors.bronze));
            }
            if (sponsors.past.length > 0) {
              dialog.add_credit_section(_('Past Sponsors'),
                                        formatSponsors(sponsors.past));
            }
          }

          dialog.set_translator_credits([...translators].join('\n'));
          dialog.set_copyright('© 2022 Simon Schneegans');
          dialog.set_website('https://github.com/Schneegans/Burn-My-Windows');
          dialog.set_license_type(Gtk.License.GPL_3_0);

          if (utils.isGTK4()) {
            dialog.show();
          } else {
            dialog.show_all();
          }
        });

        group.add_action(aboutAction);
      }

      // Setup all the profile-related actions.
      {
        // Allow switching the current profile.
        const activeProfileAction = this._settings.create_action('active-profile');
        group.add_action(activeProfileAction);

        // This action creates a new profile and makes it the active one.
        const newProfileAction = Gio.SimpleAction.new('profile-new', null);
        newProfileAction.connect('activate', () => {
          const profile = this._profileManager.createProfile();
          this._settings.set_string('active-profile', profile.path);

          // Start editing the profile.
          this._builder.get_object('edit-profile-button').active = true;

          // The number of profiles has changed, so we have to update the profile
          // selection menu.
          this._updateProfileMenu();
        });
        group.add_action(newProfileAction);

        // This action shows a confirmation dialog. Upon user approval, the currently
        // active profile is deleted.
        const deleteProfileAction = Gio.SimpleAction.new('profile-delete', null);
        deleteProfileAction.connect('activate', () => {
          this._builder.get_object('profile-delete-dialog').show();
        });

        const deleteProfileDialog = this._builder.get_object('profile-delete-dialog');
        deleteProfileDialog.set_transient_for(window);
        deleteProfileDialog.connect('response', (d, response) => {
          if (response == 'delete') {
            // Stop editing the current profile.
            this._builder.get_object('edit-profile-button').active = false;

            // Delete the currently active profile.
            this._profileManager.deleteProfile(this._activeProfile.path);

            // Select another one.
            this._settings.set_string('active-profile',
                                      this._profileManager.getProfiles()[0].path);

            // The number of profiles has changed, so we have to update the profile
            // selection menu.
            this._updateProfileMenu();
          }
        });

        group.add_action(deleteProfileAction);
      }
    });

    // As we do not have something like a destructor, we just listen for the destroy
    // signal of our main widget.
    this._widget.connect('destroy', () => {
      // Unregister our resources.
      Gio.resources_unregister(this._resources);

      // Disconnect from the window-picker API.
      Gio.DBus.session.signal_unsubscribe(this._dbusConnection);
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

  // Returns a Gio.Settings object for the current effect profile.
  getProfileSettings() {
    return this._activeProfile.settings;
  }

  // Returns the widget used for the settings of this extension.
  getWidget() {
    return this._widget;
  }

  // Connects a Gtk.ComboBox (or anything else which has an 'selected' property) to a
  // settings key. It also binds the corresponding reset button.
  bindComboBox(settingsKey) {
    this._bind(settingsKey, 'selected');
  }

  // Connects a Gtk.Entry (or anything else which has an 'text' property) to a
  // settings key. It also binds the corresponding reset button.
  bindEntry(settingsKey) {
    this._bind(settingsKey, 'text');
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
      if (!button._isConnected) {
        button.connect('color-set', () => {
          this.getProfileSettings().set_string(settingsKey,
                                               button.get_rgba().to_string());
        });

        button._isConnected = true;
      }

      // Update the button state when the settings change.
      const settingSignalHandler = () => {
        const rgba = new Gdk.RGBA();
        rgba.parse(this.getProfileSettings().get_string(settingsKey));
        button.rgba = rgba;
      };

      this._connectProfileSetting('changed::' + settingsKey, settingSignalHandler);

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

  // This loads all settings from the profile given in the settings key 'active-profile'.
  _loadActiveProfile() {

    // Disconnect any connection to the previously active profile.
    this._disconnectProfileSettings();

    // Find the active profile in the list of all profiles.
    const allProfiles   = this._profileManager.getProfiles();
    const path          = this._settings.get_string('active-profile');
    this._activeProfile = allProfiles.find(p => p.path == path);

    // If, for whatever reason, it is not found, select the first one. Setting the
    // settings key will trigger this method again.
    if (!this._activeProfile) {
      this._activeProfile = allProfiles[0];
      this._settings.set_string('active-profile', this._activeProfile.path);
      return;
    }

    // Connect all profile options.
    const updateProfileButtonMenuIfChanged = (settingsKey) => {
      this._connectProfileSetting('changed::' + settingsKey, () => {
        this._updateProfileButton();
        this._updateProfileMenu();
      });
    };

    updateProfileButtonMenuIfChanged('profile-app');
    updateProfileButtonMenuIfChanged('profile-animation-type');
    updateProfileButtonMenuIfChanged('profile-window-type');
    updateProfileButtonMenuIfChanged('profile-color-scheme');
    updateProfileButtonMenuIfChanged('profile-power-mode');
    updateProfileButtonMenuIfChanged('profile-power-profile');

    this.bindEntry('profile-app');
    this.bindComboBox('profile-animation-type');
    this.bindComboBox('profile-window-type');
    this.bindComboBox('profile-color-scheme');
    this.bindComboBox('profile-power-mode');
    this.bindComboBox('profile-power-profile');
    this.bindSwitch('profile-high-priority');

    // Connect all effect settings.
    this._ALL_EFFECTS.forEach(effect => {
      const [minMajor, minMinor] = effect.getMinShellVersion();
      if (utils.shellVersionIsAtLeast(minMajor, minMinor)) {
        this.bindSwitch(`${effect.getNick()}-enable-effect`);
        effect.bindPreferences(this);
      }
    });

    // Update the label in the profile-select button.
    this._updateProfileButton();
  }

  // This updates the label of the profile-selection button according to the currently
  // active profile. It's called whenever the active profile is changed or whenever a
  // configuration option of the profile is changed.
  _updateProfileButton() {
    this._builder.get_object('choose-profile-button').label =
      this._profileManager.getProfileName(this.getProfileSettings());
  }

  // This updates the list of available profiles in the dropdown of the profile-selection
  // button. It's called whenever one of the configuration option of the currently active
  // profile is changed, or whenever a profile is added / removed.
  _updateProfileMenu() {

    // First, clear the menu section.
    const profileSection = this._builder.get_object('profile-section');
    profileSection.remove_all();

    // Then add an entry for each available profile.
    this._profileManager.getProfiles().forEach(profile => {
      const label = this._profileManager.getProfileName(profile.settings);
      const item  = Gio.MenuItem.new(label, 'prefs.active-profile');
      item.set_action_and_target_value('prefs.active-profile',
                                       GLib.Variant.new_string(profile.path));
      profileSection.append_item(item);
    });
  }

  // This wrapper connects a given callback to a profile settings key. Use this instead of
  // the direct connect() call on the profile settings to make sure that the callback is
  // disconnected when the active profile changes.
  _connectProfileSetting(key, callback) {
    this._profileConnections.push(this.getProfileSettings().connect(key, callback));
  }

  // This is called whenever the currently edited effect profile changes. It unbinds all
  // callbacks bound with the above method before.
  _disconnectProfileSettings() {
    this._profileConnections.forEach(c => this.getProfileSettings().disconnect(c));
    this._profileConnections = [];
  }

  // Searches for a reset button for the given settings key and make it reset the settings
  // key when clicked.
  _bindResetButton(settingsKey) {
    const resetButton = this._builder.get_object('reset-' + settingsKey);
    if (resetButton && !resetButton._isConnected) {
      resetButton.connect('clicked', () => {
        this.getProfileSettings().reset(settingsKey);
      });
      resetButton._isConnected = true;
    }
  }

  // Connects any widget's property to a settings key. The widget must have the same ID as
  // the settings key. It also binds the corresponding reset button.
  _bind(settingsKey, property) {
    const object = this._builder.get_object(settingsKey);

    if (object) {
      // Unbind any previous binding (potentially to a previously edited profile).
      Gio.Settings.unbind(object, property);
      this.getProfileSettings().bind(settingsKey, object, property,
                                     Gio.SettingsBindFlags.DEFAULT);
    }

    this._bindResetButton(settingsKey);
  }

  // Reads the contents of a JSON file contained in the global resources archive. The data
  // is parsed and returned as a JavaScript object / array.
  _getJSONResource(path) {
    return JSON.parse(utils.getStringResource(path));
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

  // Opens a modal window using the given effect.
  _previewEffect(effect) {

    // Set the to-be-previewed effect.
    this._settings.set_string('preview-effect', effect.getNick());

    // Make sure that the window.show() firther below "sees" this change.
    Gio.Settings.sync();

    // Create the preview-window.
    const window = new Gtk.Window({
      // Translators: %s will be replaced by the effect's name.
      title: _('Preview for %s').replace('%s', effect.getLabel()),
      default_width: 800,
      default_height: 450,
      modal: true,
      transient_for: utils.isGTK4() ? this._widget.get_root() :
                                      this._widget.get_toplevel()
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

    const label   = Gtk.Label.new(_('Close this Window to Preview the Effect!'));
    label.wrap    = true;
    label.justify = Gtk.Justification.CENTER;
    label.get_style_context().add_class('large-title');

    const image = new Gtk.Image({
      icon_name: 'burn-my-windows-symbolic',
      pixel_size: 128,
    });

    this.gtkBoxAppend(box, image);
    this.gtkBoxAppend(box, label);

    if (utils.isGTK4()) {
      window.set_child(box);
      window.show();
    } else {
      window.add(box);
      window.show_all();
    }
  }

  // Initializes template widgets used by the preferences dialog.
  _registerCustomClasses() {

    // If we are not using libadwaita, each effect page is based on a template widget.
    // This template contains the title and the preview button.
    if (!utils.isADW() && GObject.type_from_name('BurnMyWindowsEffectPage') == null) {
      BurnMyWindowsEffectPage = GObject.registerClass(
        {
          GTypeName: 'BurnMyWindowsEffectPage',
          Template: `resource:///ui/${utils.getUIDir()}/effectPage.ui`,
          InternalChildren: ['label', 'button'],
        },
        class BurnMyWindowsEffectPage extends Gtk.Box {  // ------------------------------
          _init(effect, dialog) {
            super._init();

            // Set the effect's name as label.
            this._label.label = effect.getLabel();

            // Open the preview window once the preview button is clicked.
            this._button.connect('clicked', () => {
              dialog._previewEffect(effect);
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

function fillPreferencesWindow(window) {
  window.set_default_size(700, 700);
  var dialog = new PreferencesDialog();
  window.add(dialog.getWidget());
}