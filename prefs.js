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
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk';
import Adw from 'gi://Adw';

import * as utils from './src/utils.js';
import {ProfileManager} from './src/ProfileManager.js';

import Apparition from './src/effects/Apparition.js';
import BrokenGlass from './src/effects/BrokenGlass.js';
import Doom from './src/effects/Doom.js';
import EnergizeA from './src/effects/EnergizeA.js';
import EnergizeB from './src/effects/EnergizeB.js';
import Fire from './src/effects/Fire.js';
import Focus from './src/effects/Focus.js';
import Glide from './src/effects/Glide.js';
import Glitch from './src/effects/Glitch.js';
import Hexagon from './src/effects/Hexagon.js';
import Incinerate from './src/effects/Incinerate.js';
import Matrix from './src/effects/Matrix.js';
import PaintBrush from './src/effects/PaintBrush.js';
import Pixelate from './src/effects/Pixelate.js';
import PixelWheel from './src/effects/PixelWheel.js';
import PixelWipe from './src/effects/PixelWipe.js';
import Portal from './src/effects/Portal.js';
import SnapOfDisintegration from './src/effects/SnapOfDisintegration.js';
import TRexAttack from './src/effects/TRexAttack.js';
import TVEffect from './src/effects/TVEffect.js';
import TVGlitch from './src/effects/TVGlitch.js';
import Wisps from './src/effects/Wisps.js';


import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Currently, the extension supports only one set of UI files. In the past, there were
// three different sets for GTK3, GTK4, and Adwaita. This method returns the name of the
// current UI directory. It's still here since it might be useful in the future.
function getUIDir() {
  return 'adw';
}

//////////////////////////////////////////////////////////////////////////////////////////
// The preferences dialog is organized in pages, each of which is loaded from a         //
// separate ui file. There's one page with general options, all other paged are loaded  //
// from the respective effects.                                                         //
//////////////////////////////////////////////////////////////////////////////////////////

export default class BurnMyWindowsPreferences extends ExtensionPreferences {

  // ------------------------------------------------------------ constructor / destructor

  fillPreferencesWindow(window) {
    window.set_default_size(650, 750);

    // New effects must be registered here and in extension.js.
    this._ALL_EFFECTS = [
      Apparition, BrokenGlass, Doom,       EnergizeA, EnergizeB,  Fire,
      Focus,      Glide,       Glitch,     Hexagon,   Incinerate, Matrix,
      PaintBrush, Pixelate,    PixelWheel, PixelWipe, Portal,     SnapOfDisintegration,
      TRexAttack, TVEffect,    TVGlitch,   Wisps,
    ];


    // Load all of our resources.
    this._resources =
      Gio.Resource.load(this.path + '/resources/burn-my-windows.gresource');
    Gio.resources_register(this._resources);

    // Make sure custom icons are found.
    Gtk.IconTheme.get_for_display(Gdk.Display.get_default()).add_resource_path('/img');

    // Load the general user interface files.
    this._builder = new Gtk.Builder();
    this._builder.add_from_resource(`/ui/common/menus.ui`);
    this._builder.add_from_resource(`/ui/${getUIDir()}/prefs.ui`);


    // Store a reference to the general settings object.
    this._settings = this.getSettings();

    // This tracks all available effect profiles.
    this._profileManager = new ProfileManager(this.metadata);

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


    let powerProfileRow = this._builder.get_object('profile-power-profile');
    powerProfileRow.set_visible(hasPowerProfiles);

    // Wire up the window picker of the profile editor. Whenever the app-chooser button is
    // clicked, we call a method of the extension which will initiate the window picking.
    this._builder.get_object('profile-choose-app-button').connect('clicked', () => {
      Gio.DBus.session.call('org.gnome.Shell',
                            '/org/gnome/shell/extensions/BurnMyWindows',
                            'org.gnome.shell.extensions.BurnMyWindows', 'PickWindow',
                            null, null, Gio.DBusCallFlags.NO_AUTO_START, -1, null, null);
    });

    // If the window picking was successful, this D-Bus signal will be emitted. If a
    // window was picked, we add it to the list of window name.
    this._dbusConnection = Gio.DBus.session.signal_subscribe(
      'org.gnome.Shell', 'org.gnome.shell.extensions.BurnMyWindows', 'WindowPicked',
      '/org/gnome/shell/extensions/BurnMyWindows', null, Gio.DBusSignalFlags.NONE,
      (conn, sender, obj_path, iface, signal, params) => {
        const val = params.get_child_value(0).get_string()[0];
        if (val != 'window-not-found') {
          const entry = this._builder.get_object('profile-app');

          // Split the current value at each |, trim spaces, and remove empty components.
          let apps = entry.text.split('|').map(item => item.trim()).filter(v => v != '');

          // If the list is empty, we simply use the name of the picked window.
          if (apps.length == 0) {
            entry.text = val;
          } else {

            // Else we append the new application name, remove any duplicates, and sort
            // the resulting list alphabetically.
            apps.push(val);
            apps       = [...new Set(apps)].sort();
            entry.text = apps.join(' | ');
          }
        }
      });


    // This is our top-level widget which we will return later.
    this._widget = this._builder.get_object('general-prefs');

    // Add the functionality to the choose-all and choose-none buttons.
    this._builder.get_object('choose-all-effects-button').connect('clicked', () => {
      this._ALL_EFFECTS.forEach(effect => {
        this.getProfileSettings().set_boolean(`${effect.getNick()}-enable-effect`, true);
      });
    });

    this._builder.get_object('choose-no-effects-button').connect('clicked', () => {
      this._ALL_EFFECTS.forEach(effect => {
        this.getProfileSettings().set_boolean(`${effect.getNick()}-enable-effect`, false);
      });
    });

    // search for effect feature
    this._searchEntry = this._builder.get_object('search_entry');
    this._searchEntry.connect('search-changed', () => {
      const query = this._searchEntry.get_text().toLowerCase();

      this._effectRows.forEach(er => {
        if (query === '') {
          er.show();  // Show all effects if query is empty
        } else {
          // Show or hide each effect based on query match
          const showEffect = er.name.toLowerCase().includes(query);
          showEffect ? er.show() : er.hide();

          // TODO
          // maybe add a fuzzy search later
          /*
          const showEffect = utils.fuzzyMatch(er.name.toLowerCase(),
          query.toLowerCase()); showEffect ? er.show() : er.hide();
          */
        }
      });
    });

    // Then add a preferences group for the effect expander rows.
    const group = this._builder.get_object('effects-group');

    // This stores all expander rows for the effects. We use this to implement the
    // accordion-like behavior of the effect settings.
    this._effectRows = [];

    // Now add all the rows.
    this._ALL_EFFECTS.forEach(effect => {
      const [minMajor, minMinor] = effect.getMinShellVersion();
      if (utils.shellVersionIsAtLeast(minMajor, minMinor)) {

        const uiFile = `/ui/${getUIDir()}/${effect.getNick()}.ui`;

        // Is there a better way to test for the existence of a resource file?
        let hasPrefs = false;
        try {
          Gio.resources_get_info(uiFile, 0);
          hasPrefs = true;
        } catch (e) {
          // Nothing todo, there
        }

        // Add the settings page to the builder.
        if (hasPrefs) {
          this._builder.add_from_resource(uiFile);
        }

        // The preview button.
        let previewButton = Gtk.Button.new_from_icon_name('bmw-preview-symbolic');
        previewButton.get_style_context().add_class('circular');
        previewButton.get_style_context().add_class('flat');
        previewButton.set_tooltip_text(_('Preview this effect'));
        previewButton.set_valign(Gtk.Align.CENTER);
        previewButton.connect('clicked', () => {
          this._previewEffect(effect);
        });

        // The toggle button for enabling and disabling the effect.
        const button = Gtk.Switch.new();
        button.set_valign(Gtk.Align.CENTER);
        this._builder.expose_object(`${effect.getNick()}-enable-effect`, button);

        let row;
        if (hasPrefs) {

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

        // this is the fix for the merge issue when an effect doesn't have a discription
        row.name = effect.getLabel();


        // Un-expand any previously expanded effect row. This way we ensure that there
        // is only one expanded row at any time.
        if (hasPrefs) {
          row.connect('notify::expanded', currentRow => {
            if (currentRow.get_expanded()) {
              this._effectRows.forEach(row => {
                if (row != currentRow) {
                  row.set_expanded(false);
                }
              });
            }
          });
          this._effectRows.push(row);
          row.add_action(button);
        } else {
          row.add_suffix(button);
        }

        row.add_prefix(previewButton);

        group.add(row);
      }
    });


    // Some things can only be done once the widget is shown as we do not have access to
    // the toplevel widget before.
    this._widget.connect('realize', (widget) => {
      const window = widget.get_root();

      // Show the version number in the title bar.
      window.set_title(`Burn-My-Windows ${this.metadata.version}`);

      this._loadActiveProfile();
      this._updateProfileMenu();

      // Show an Adw.Toast or a Gtk.InfoBar whenever Burn-My-Windows was updated. We use a
      // small timeout so that it is not shown instantaneously.
      const lastVersion = this._settings.get_int('last-prefs-version');
      if (lastVersion < this.metadata.version) {
        this._showUpdateInfoTimeout =
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            this._showUpdateInfoTimeout = 0;

            const toast = Adw.Toast.new(_('Burn-My-Windows has been updated!'));
            toast.set_button_label(_('View Changelog'));
            toast.set_action_name('prefs.changelog');
            toast.set_timeout(0);

            toast.connect(
              'dismissed',
              () => this._settings.set_int('last-prefs-version', this.metadata.version));

            window.add_toast(toast);

            return false;
          });
      }

      // Count the number of times the user has opened the preferences window. Every now
      // and then, we show a dialog asking the user to support the extension. We connect
      // to the notify::visible signal to ensure that the dialog can be a modal dialog.
      window.connect('notify::visible', (window) => {
        // Do not show the dialog when the window is hidden.
        if (!window.get_visible()) {
          return;
        }

        // Do not show the dialog when the user has disabled it.
        if (!this._settings.get_boolean('show-support-dialog')) {
          return;
        }

        const count = this._settings.get_int('prefs-open-count') + 1;
        this._settings.set_int('prefs-open-count', count);

        // Show the dialog every 10th time.
        if (count % 10 == 0) {
          const dialog = this._createMessageDialog(
            '❤️ Do you love Burn-My-Windows?',
            `Even the smallest donation can have a big impact! If just one of ten Burn-My-Windows users donated $1 per month, I could dedicate myself to creating awesome open-source projects full-time!

Ko-fi: <a href='https://ko-fi.com/schneegans'>https://ko-fi.com/schneegans</a>
GitHub: <a href='https://github.com/sponsors/schneegans'>https://github.com/sponsors/schneegans</a>`,
            window, [
              {
                label: 'Do not show this again!',
                destructive: true,
                default: false,
                action: () => {
                  this._settings.set_boolean('show-support-dialog', false);
                }
              },
              {
                label: 'Remind me later.',
                destructive: false,
                default: true,
              }
            ]);

          dialog.show();
        }
      });

      // Populate the menu with actions.
      const group = Gio.SimpleActionGroup.new();
      window.insert_action_group('prefs', group);

      // Add the main menu to the title bar.
      {
        // Add the menu button to the title bar.
        const menu = this._builder.get_object('menu-button');

        // Starting with GNOME Shell 42, we have to hack our way through the widget tree
        // of the Adw.PreferencesWindow...
        const header = this._findWidgetByType(window.get_content(), Adw.HeaderBar);
        header.pack_start(menu);
        header.set_title_widget(this._builder.get_object('profile-button'));

        // GNOME Shell extensions are forced to use a AdwPreferencesWindow. This already
        // includes a Gtk.ScrolledWindow as well as an Adw.Clamp. For the profile
        // editing, we want to use an Adw.Flap which reveals itself from the top. This
        // needs to be inserted in the widget hierarchy above the Adw.Clamp, else it
        // would look ugly. Therefore, we fiddle around with the internal widgets...
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

        const addURIAction = (name, uri) => {
          const action = Gio.SimpleAction.new(name, null);
          action.connect('activate', () => Gtk.show_uri(null, uri, Gdk.CURRENT_TIME));
          group.add_action(action);
        };

        // clang-format off
        addURIAction('homepage',      'https://github.com/Schneegans/Burn-My-Windows');
        addURIAction('bugs',          'https://github.com/Schneegans/Burn-My-Windows/issues');
        addURIAction('new-effect',    'https://github.com/Schneegans/Burn-My-Windows/blob/main/docs/how-to-create-new-effects.md');
        addURIAction('translate',     'https://hosted.weblate.org/engage/burn-my-windows/');
        addURIAction('donate-kofi',   'https://ko-fi.com/schneegans');
        addURIAction('donate-github', 'https://github.com/sponsors/Schneegans');
        addURIAction('donate-paypal', 'https://www.paypal.me/simonschneegans');
        addURIAction('donate-crypto', 'https://schneegans.cb.id');
        addURIAction('show-sponsors', 'https://schneegans.github.io/sponsors');
        addURIAction('wallpapers',    'https://github.com/Schneegans/ai-wallpapers');
        addURIAction('profile-dir',   `file://${GLib.get_user_config_dir()}/burn-my-windows/profiles`);
        // clang-format on

        // The changelog action is a bit different, as it may get activated when the
        // view-changelog button is pressed which is shown in an Adw.Toast or a
        // Gtk.InfoBar whenever Burn-My-Windows gets updated. To ensure that the
        // notification is shown only once, we have to store the current version of
        // Burn-My-Windows in the settings.
        const changelogAction = Gio.SimpleAction.new('changelog', null);
        changelogAction.connect('activate', () => {
          Gtk.show_uri(
            null,
            'https://github.com/Schneegans/Burn-My-Windows/blob/main/docs/changelog.md',
            Gdk.CURRENT_TIME);
          this._settings.set_int('last-prefs-version', this.metadata.version)
        });
        group.add_action(changelogAction);

        // Add the about dialog.
        const aboutAction = Gio.SimpleAction.new('about', null);
        aboutAction.connect('activate', () => {
          // The JSON report format from weblate is a bit weird. Here we extract all
          // unique names from the translation report.
          const translators = new Set();
          this._getJSONResource('/credits/translators.json').forEach(i => {
            for (const j of Object.values(i)) {
              j.forEach(k => translators.add(k.full_name));
            }
          });

          const dialog = new Adw.AboutWindow({transient_for: window, modal: true});
          dialog.set_application_icon('burn-my-windows-symbolic');
          dialog.set_application_name('Burn-My-Windows');
          dialog.set_version(`${this.metadata.version}`);
          dialog.set_developer_name('Simon Schneegans');
          dialog.set_issue_url('https://github.com/Schneegans/Burn-My-Windows/issues');
          dialog.set_translator_credits([...translators].join('\n'));
          dialog.set_copyright('© 2023 Simon Schneegans');
          dialog.set_website('https://github.com/Schneegans/Burn-My-Windows');
          dialog.set_license_type(Gtk.License.GPL_3_0);

          dialog.show();
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
        // active profile is deleted. We use the more beautiful Adw.MessageDialog if it is
        // available (usually on GNOME 43 and beyond).
        const deleteProfileDialog = this._createMessageDialog(
          _('Delete this Profile?'),
          _('The current effect profile with all its effect settings will be permanently lost.'),
          window, [
            {
              label: _('Cancel'),
              destructive: false,
              default: true,
            },
            {
              label: _('Delete'),
              destructive: true,
              default: false,
              action: () => {
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
            }
          ]);

        // This action deletes the currently active profile.
        const deleteProfileAction = Gio.SimpleAction.new('profile-delete', null);
        deleteProfileAction.connect('activate', () => {
          deleteProfileDialog.show();
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

      // If the settings dialog got closed too quickly, this may not have been shown.
      if (this._showUpdateInfoTimeout > 0) {
        GLib.source_remove(this._showUpdateInfoTimeout);
      }
    });

    window.add(this._widget);
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

  // Connects an Adw.ComboRow (or anything else which has an 'selected' property) to a
  // settings key. It also binds the corresponding reset button.
  bindComboRow(settingsKey) {
    this._bind(settingsKey, 'selected');
  }

  // Connects a Gtk.ComboBox (or anything else which has an 'active' property) to a
  // settings key. It also binds the corresponding reset button.
  bindComboBox(settingsKey) {
    this._bind(settingsKey, 'active');
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
    updateProfileButtonMenuIfChanged('profile-high-priority');

    this.bindEntry('profile-app');
    this.bindComboRow('profile-animation-type');
    this.bindComboRow('profile-window-type');
    this.bindComboRow('profile-color-scheme');
    this.bindComboRow('profile-power-mode');
    this.bindComboRow('profile-power-profile');
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
      this._getProfileName(this.getProfileSettings());
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
      const label = this._getProfileName(profile.settings);
      const item  = Gio.MenuItem.new(label, 'prefs.active-profile');
      item.set_action_and_target_value('prefs.active-profile',
                                       GLib.Variant.new_string(profile.path));
      profileSection.append_item(item);
    });
  }

  // Profiles are named according to their configuration. This method returns a localized
  // string describing the settings of the profile.
  _getProfileName(settings) {
    let items = [];

    // If an app is configured, use it as first component for the profile's name.
    const app = settings.get_string('profile-app');
    if (app != '') {
      items.push(app);
    }

    // Now add components to the name for each non-default profile option. Make sure that
    // these are the same strings as used in the UI files!
    const addComponent = (settingsKey, options) => {
      const option = settings.get_int(settingsKey);
      if (option > 0) {
        items.push(options[option - 1]);
      }
    };

    // clang-format off
    addComponent('profile-animation-type', [_('Opening Windows'),
                                            _('Closing Windows')]);
    addComponent('profile-window-type',    [_('Normal Windows'),
                                            _('Dialog Windows')]);
    addComponent('profile-color-scheme',   [_('Default Color Scheme'),
                                            _('Dark Color Scheme')]);
    addComponent('profile-power-mode',     [_('On Battery'),
                                            _('Plugged In')]);
    addComponent('profile-power-profile',  [_('Power-Saver Mode'),
                                            _('Balanced Mode'),
                                            _('Performance Mode'),
                                            _('Power Saver or Balanced'),
                                            _('Balanced or Performance')]);
    // clang-format on

    // If the profile is a high-priority profile, also add this..
    if (settings.get_boolean('profile-high-priority')) {
      items.push(_('High Priority'));
    }

    let name = '';

    if (items.length == 0) {
      name = _('Standard Profile');
    } else {
      name = items.join(' · ');
    }

    return name;
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
      transient_for: this._widget.get_root()
    });

    // Add a header bar to the window.
    const header = Gtk.HeaderBar.new();
    window.set_titlebar(header);

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

    box.append(image);
    box.append(label);

    window.set_child(box);
    window.show();
  }

  // Helper function to show a message dialog. The dialog is modal and has a title, a
  // message and a list of buttons. Each button is an object with a label, a default flag
  // and a destructive flag. Each button object can also have an "action" callback that is
  // called when the button is clicked.
  // This method works on GTK3, GTK4, and libadwaita.
  _createMessageDialog(title, message, window, buttons) {
    let dialog = new Adw.MessageDialog({
      heading: title,
      body: message,
      body_use_markup: true,
      modal: true,
    });

    buttons.forEach((button, i) => {
      const response = i.toString();
      dialog.add_response(response, button.label);

      if (button.default) {
        dialog.set_default_response(response);
        dialog.set_close_response(response);
      }

      if (button.destructive) {
        dialog.set_response_appearance(response, Adw.ResponseAppearance.DESTRUCTIVE);
      }
    });

    dialog.set_hide_on_close(true);
    dialog.set_transient_for(window);

    // If the dialog is closed or a button is clicked, we hide the dialog and call the
    // button's action callback if it exists.
    dialog.connect('response', (dialog, response) => {
      const i = parseInt(response);

      const button = buttons[i];
      if (button && button.action) {
        button.action();
      }

      dialog.hide();
    });

    return dialog;
  }
}
