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

const {Gio, GLib, GObject} = imports.gi;

const _ = imports.gettext.domain('burn-my-windows').gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// Burn-My-Windows allows applying different sets of effect settings under specific     //
// circumstances. These settings are called "effect profiles". The ProfileManager       //
// provides access to all currently configured effect profiles. It can be used in both  //
// the settings dialog and the in the actual extension.                                 //
// The profiles are stored in ~/.config/burn-my-windows/profiles and can be accessed    //
// via Gio.Settings objects.                                                            //
//////////////////////////////////////////////////////////////////////////////////////////

var ProfileManager = class {
  // ------------------------------------------------------------------------- constructor

  constructor() {
    this._makeProfilesDir();
    this.reloadProfiles();
  }

  // -------------------------------------------------------------------- public interface

  // Returns an array of effect profiles. Each effect profile is an object with two
  // properties: The 'path' points to the file which contains the effect profile
  // settings (located in ~/.config/burn-my-windows/profiles). The 'settings' property
  // contains a Gio.Settings object for the profile. The former can be used to uniquely
  // identify the profile, the latter can be used to access the profile's settings. This
  // method will always return at least one profile. If none is configured, a default
  // profile will be created.
  getProfiles() {
    if (this._profiles.length == 0) {
      this.createProfile();
    }

    return this._profiles;
  }

  // This will create a new profile. If no content is given, all values will be
  // initialized to their defaults. The method will return an effect profile object (as
  // described above). We will use the current system time in microseconds as profile
  // name. This ensures that they are always sorted according to their creation date.
  createProfile(content = '') {
    const path = `${GLib.get_user_config_dir()}/burn-my-windows/profiles/${
      GLib.get_real_time()}.conf`;
    const file = Gio.File.new_for_path(path);
    file.create(Gio.FileCreateFlags.NONE, null);

    if (content != '') {
      file.replace_contents(content, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION,
                            null);
    }

    const profile = {'path': path, 'settings': this._getProfileSettings(path)};

    // Add the profile to our internal list of profiles.
    this._profiles.push(profile);

    return profile;
  }

  // Removes a profile defined by its file path. This will actually remove the file from
  // the disk, so there's no going back.
  deleteProfile(profilePath) {
    const profileDir = `${GLib.get_user_config_dir()}/burn-my-windows/profiles`;
    const file       = Gio.File.new_for_path(profilePath);
    if (file.has_prefix(Gio.File.new_for_path(profileDir)) && file.query_exists(null)) {
      file.delete(null);
    }

    // Remove the profile from our internal list of profiles.
    this._profiles = this._profiles.filter(p => p.path != profilePath);
  }

  // Reloads all profiles from ~/.config/burn-my-windows/profiles. If you called the
  // createProfile() and deleteProfile() methods above, there is no need to reload the
  // profiles.
  reloadProfiles() {
    const dir =
      Gio.File.new_for_path(GLib.get_user_config_dir() + '/burn-my-windows/profiles');

    const files =
      dir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);

    let profilePaths = [];

    while (true) {
      const presetInfo = files.next_file(null);

      if (presetInfo == null) {
        break;
      }

      if (presetInfo.get_file_type() == Gio.FileType.REGULAR) {
        const suffixPos = presetInfo.get_display_name().indexOf('.conf');
        if (suffixPos > 0) {
          profilePaths.push(dir.get_child(presetInfo.get_name()).get_path());
        }
      }
    }

    // Sort profiles alphabetically, that is by their creation time.
    profilePaths.sort();

    this._profiles = [];

    profilePaths.forEach(path => {
      this._profiles.push({'path': path, 'settings': this._getProfileSettings(path)});
    });
  }

  // Each profile has a priority. It is higher, the more specific it is.
  getProfilePriority(settings) {
    let priority = 0;

    // If an application is specified, we increase the priority quite a lot. This makes
    // sure that per-application overrides are used in most cases.
    if (settings.get_string('profile-app') != '') priority += 10;

    // Each other setting which is not set to its default value increases the priority by
    // one.
    if (settings.get_int('profile-animation-type') > 0) ++priority;
    if (settings.get_int('profile-window-type') > 0) ++priority;
    if (settings.get_int('profile-color-scheme') > 0) ++priority;
    if (settings.get_int('profile-power-mode') > 0) ++priority;
    if (settings.get_int('profile-power-profile') > 0) ++priority;

    // Increase the priority significantly for high-priority profiles.
    if (settings.get_boolean('profile-high-priority')) priority += 100;

    return priority;
  }

  // Profiles are named according to their configuration. This method returns a localized
  // string describing the settings of the profile.
  getProfileName(settings) {
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

  // ----------------------------------------------------------------------- private stuff

  // Creates the directory ~/.config/burn-my-windows/profiles if it does not yet exist.
  _makeProfilesDir() {
    const path = `${GLib.get_user_config_dir()}/burn-my-windows/profiles`;
    const dir  = Gio.File.new_for_path(path);

    if (!dir.query_exists(null)) {
      dir.make_directory_with_parents(null);
    }
  }

  // Creates a Gio.Settings object for the given effect profile path. Based on
  // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/misc/extensionUtils.js#L213
  _getProfileSettings(profilePath) {

    // Expect USER extensions to have a schemas/ subfolder, otherwise assume a
    // SYSTEM extension that has been installed in the same prefix as the shell
    const schemaDir = Me.dir.get_child('schemas');
    let source;
    if (schemaDir.query_exists(null)) {
      source = Gio.SettingsSchemaSource.new_from_directory(
        schemaDir.get_path(), Gio.SettingsSchemaSource.get_default(), false);
    } else {
      source = Gio.SettingsSchemaSource.get_default();
    }

    const schema =
      source.lookup('org.gnome.shell.extensions.burn-my-windows-profile', true);

    const backend =
      Gio.keyfile_settings_backend_new(profilePath, '/org/gnome/shell/extensions/', null);

    return new Gio.Settings({settings_schema: schema, backend: backend});
  }
}