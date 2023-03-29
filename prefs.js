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

    // Load the CSS file for the settings dialog. If using libadwaita, we do not need an
    // additional style sheet.
    if (!utils.isADW()) {
      const provider = Gtk.CssProvider.new();
      if (utils.isGTK4()) {
        provider.load_from_resource('/css/gtk4.css');
        Gtk.StyleContext.add_provider_for_display(
          Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
      } else {
        provider.load_from_resource('/css/gtk3.css');
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), provider,
                                                 Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
      }
    }

    // Make sure custom icons are found.
    if (utils.isGTK4()) {
      Gtk.IconTheme.get_for_display(Gdk.Display.get_default()).add_resource_path('/img');
    } else {
      Gtk.IconTheme.get_default().add_resource_path('/img');
    }

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

    let powerProfileRow = this._builder.get_object('profile-power-profile');
    if (!utils.isADW()) {
      powerProfileRow = powerProfileRow.get_parent().get_parent();
    }
    powerProfileRow.set_visible(hasPowerProfiles);

    // The global color scheme is only available starting with GNOME Shell 42. We hide the
    // corresponding settings row on older versions.
    let colorSchemeRow = this._builder.get_object('profile-color-scheme');
    if (!utils.isADW()) {
      colorSchemeRow = colorSchemeRow.get_parent().get_parent();
    }
    colorSchemeRow.set_visible(utils.shellVersionIsAtLeast(42, 0));

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

    // If using libadwaita, the visibility of the profile-editor Adw.Flap is controlled
    // using bindings in the ui file. On GTK3 and GTK4 we have to wire up this toggling
    // here since we are using a Gtk.Stack instead of an Adw.Flap.
    if (!utils.isADW()) {
      const profileEditorButton = this._builder.get_object('edit-profile-button');
      profileEditorButton.connect('toggled', b => {
        if (b.active) {
          this._builder.get_object('general-prefs')
            .set_visible_child(this._builder.get_object('profile-editor'));
        } else {
          this._builder.get_object('general-prefs')
            .set_visible_child(this._builder.get_object('effect-editor'));
        }
      });
    }

    // This is our top-level widget which we will return later.
    this._widget = this._builder.get_object('general-prefs');

    // Then add a preferences group for the effect expander rows.
    const group = this._builder.get_object('effects-group');

    // This stores all expander rows for the effects. We use this to implement the
    // accordion-like behavior of the effect settings.
    this._effectRows = [];

    if (!utils.isADW()) {
      group.connect('row-activated', (g, row) => {
        this._effectRows.forEach(r => {
          if (r == row) {
            if (r._revealer.get_reveal_child()) {
              r._revealer.set_reveal_child(false);
              r._arrow.get_style_context().remove_class('revealed');
            } else {
              r._revealer.set_reveal_child(true);
              r._arrow.get_style_context().add_class('revealed');
            }
          } else {
            r._revealer.set_reveal_child(false);
            r._arrow.get_style_context().remove_class('revealed');
          }
        });
      });
    }

    // Now add all the rows.
    this._ALL_EFFECTS.forEach(effect => {
      const [minMajor, minMinor] = effect.getMinShellVersion();
      if (utils.shellVersionIsAtLeast(minMajor, minMinor)) {

        const uiFile = `/ui/${utils.getUIDir()}/${effect.getNick()}.ui`;

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
        let previewButton;
        if (utils.isGTK4()) {
          previewButton = Gtk.Button.new_from_icon_name('bmw-preview-symbolic');
        } else {
          previewButton = Gtk.Button.new_from_icon_name('bmw-preview-symbolic', 1);
        }
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

        if (utils.isADW()) {

          let row;
          if (hasPrefs) {

            // Add the effect's preferences (if any).
            row = this._builder.get_object(`${effect.getNick()}-prefs`);
          } else if (utils.isADW()) {
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
                  if (row != currentRow) {
                    row.set_expanded(false);
                  }
                });
              }
            });
            this._effectRows.push(row);
            row.add_action(previewButton);
          } else {
            row.add_suffix(previewButton);
          }

          row.add_prefix(button);

          group.add(row);


        } else {

          const row = new Gtk.ListBoxRow();
          row.get_style_context().add_class('effect-row');

          const container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});

          const header = new Gtk.Box({spacing: 12});
          header.get_style_context().add_class('effect-row-header');

          const label = new Gtk.Label(
            {label: effect.getLabel(), hexpand: true, halign: Gtk.Align.START});
          label.get_style_context().add_class('heading');

          this.gtkBoxAppend(header, button);
          this.gtkBoxAppend(header, label);
          this.gtkBoxAppend(header, previewButton);
          this.gtkBoxAppend(container, header);

          if (hasPrefs) {
            const revealer = this._builder.get_object(`${effect.getNick()}-prefs`);
            const arrow    = new Gtk.Image({icon_name: 'go-down-symbolic'});
            arrow.get_style_context().add_class('revealer-arrow');
            this.gtkBoxAppend(header, arrow);
            this.gtkBoxAppend(container, revealer);
            row._revealer = revealer;
            row._arrow    = arrow;

            row.set_activatable(true);
            this._effectRows.push(row);
          } else {
            row.set_activatable(false);
          }

          if (utils.isGTK4()) {
            row.set_child(container);
            group.append(row);
          } else {
            row.add(container);
            group.add(row);
          }
        }
      }
    });

    // Some things can only be done once the widget is shown as we do not have access to
    // the toplevel widget before.
    this._widget.connect('realize', (widget) => {
      const window = utils.isGTK4() ? widget.get_root() : widget.get_toplevel();

      // Show the version number in the title bar.
      window.set_title(`Burn-My-Windows ${Me.metadata.version}`);

      this._loadActiveProfile();
      this._updateProfileMenu();

      // Show an Adw.Toast or a Gtk.InfoBar whenever Burn-My-Windows was updated. We use a
      // small timeout so that it is not shown instantaneously.
      const lastVersion = this._settings.get_int('last-prefs-version');
      if (lastVersion < Me.metadata.version) {
        this._showUpdateInfoTimeout =
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            this._showUpdateInfoTimeout = 0;

            if (utils.isADW()) {
              const toast = Adw.Toast.new(_('Burn-My-Windows has been updated!'));
              toast.set_button_label(_('View Changelog'));
              toast.set_action_name('prefs.changelog');
              toast.set_timeout(0);

              toast.connect(
                'dismissed',
                () => this._settings.set_int('last-prefs-version', Me.metadata.version));

              window.add_toast(toast);
            } else {
              const infoBar = this._builder.get_object('update-info');
              infoBar.connect('response', i => {
                this._settings.set_int('last-prefs-version', Me.metadata.version);
                i.set_revealed(false);
              });
              infoBar.set_revealed(true);
            }

            return false;
          });
      }

      // Populate the menu with actions.
      const group = Gio.SimpleActionGroup.new();
      window.insert_action_group('prefs', group);

      // Add the main menu to the title bar.
      {
        // Add the menu button to the title bar.
        const menu = this._builder.get_object('menu-button');

        // Starting with GNOME Shell 42, we have to hack our way through the widget tree
        // of the Adw.PreferencesWindow...
        if (utils.isADW()) {
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

        } else if (utils.isGTK4()) {
          window.get_titlebar().pack_start(menu);
          window.get_titlebar().set_title_widget(
            this._builder.get_object('profile-button'));
        } else {
          window.get_titlebar().pack_start(menu);
          window.get_titlebar().set_custom_title(
            this._builder.get_object('profile-button'));
        }

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
        addURIAction('donate-paypal', 'https://www.paypal.com/donate/?hosted_button_id=3F7UFL8KLVPXE');
        addURIAction('wallpapers',    'https://github.com/Schneegans/ai-wallpapers');
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
          this._settings.set_int('last-prefs-version', Me.metadata.version)
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
        // active profile is deleted. We use the more beautiful Adw.MessageDialog if it is
        // available (usually on GNOME 43 and beyond).
        let deleteProfileDialog;
        const dialogTitle    = _('Delete this Profile?');
        const dialogSubtitle = _(
          'The current effect profile with all its effect settings will be permanently lost.');

        if (utils.isADW() && Adw.MessageDialog) {
          deleteProfileDialog =
            new Adw.MessageDialog({heading: dialogTitle, body: dialogSubtitle});
          deleteProfileDialog.add_response('cancel', _('Cancel'));
          deleteProfileDialog.add_response('delete', _('Delete'));
          deleteProfileDialog.set_response_appearance('delete',
                                                      Adw.ResponseAppearance.DESTRUCTIVE);
          deleteProfileDialog.set_default_response('cancel');
          deleteProfileDialog.set_close_response('cancel');
        } else {
          deleteProfileDialog = new Gtk.MessageDialog({
            text: dialogTitle,
            secondary_text: dialogSubtitle,
            modal: true,
            title: '',
            buttons: Gtk.ButtonsType.OK_CANCEL
          });
        }

        if (utils.isGTK4()) {
          deleteProfileDialog.set_hide_on_close(true);
        }

        deleteProfileDialog.set_transient_for(window);

        deleteProfileDialog.connect('response', (dialog, response) => {
          if (response == 'delete' || response == Gtk.ResponseType.OK) {
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

          dialog.hide();
        });

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

  // ----------------------------------------------------------------- GTK3 / GTK4 helpers

  // Appends the given child widget to the given Gtk.Box.
  gtkBoxAppend(box, child) {
    if (utils.isGTK4()) {
      box.append(child);
    } else {
      box.pack_start(child, false, true, 0);
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
    updateProfileButtonMenuIfChanged('profile-high-priority');

    this.bindEntry('profile-app');

    if (utils.isADW()) {
      this.bindComboRow('profile-animation-type');
      this.bindComboRow('profile-window-type');
      this.bindComboRow('profile-color-scheme');
      this.bindComboRow('profile-power-mode');
      this.bindComboRow('profile-power-profile');
    } else {
      this.bindComboBox('profile-animation-type');
      this.bindComboBox('profile-window-type');
      this.bindComboBox('profile-color-scheme');
      this.bindComboBox('profile-power-mode');
      this.bindComboBox('profile-power-profile');
    }
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

// If using libadwaita, this method is called. In this case, the primary widget of the
// preferences dialog is an Adw.PreferencesPage, which we directly add to the window.
function fillPreferencesWindow(window) {
  window.set_default_size(650, 750);
  var dialog = new PreferencesDialog();
  window.add(dialog.getWidget());
}