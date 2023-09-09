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

import {ProfileManager} from './ProfileManager.js';
import * as utils from './utils.js';

// Migrating from pre-27 versions is pretty involved. Before, all settings were stored in
// the standard Gio.Settings backend. Now, there are effect profiles. Depending on the
// settings one or two profiles may be required.
export async function fromVersion26() {
  return utils
    .executeCommand(['dconf', 'dump', '/org/gnome/shell/extensions/burn-my-windows/'])
    .catch(r => utils.debug('Failed to get old settings for effect migration: ' + r))
    .then(r => {
      // If there were no settings before, we do not have to migrate anything. Just use
      // the new defaults.
      if (r == '') {
        return;
      }

      utils.debug('Starting Burn-My-Windows profile migration (old version <= 26)!');

      // We use this to write the new profiles.
      const profileManager = new ProfileManager();

      // The default value of this was false, so not-present is equal to false.
      const destroyDialogs = r.includes('destroy-dialogs=true');
      if (!destroyDialogs) {
        utils.debug('Only normal windows will be burned by the new profile(s).');
      }

      // The default value of this was false, so not-present is equal to false.
      const disableOnBattery = r.includes('disable-on-battery=true');
      if (disableOnBattery) {
        utils.debug('The new profile(s) will not be active on battery.');
      }

      // The default value of this was false, so not-present is equal to false.
      const disableOnPowerSave = r.includes('disable-on-power-save=true');
      if (disableOnPowerSave) {
        utils.debug('The new profile(s) will not be active in power-save mode.');
      }

      // Remove some unnecessary lines.
      r = r.replace(/^active-profile=.*\n?/gm, '');
      r = r.replace(/^test-mode=.*\n?/gm, '');
      r = r.replace(/^last-extension-version=.*\n?/gm, '');
      r = r.replace(/^last-prefs-version=.*\n?/gm, '');
      r = r.replace(/^destroy-dialogs=.*\n?/gm, '');
      r = r.replace(/^disable-on-battery=.*\n?/gm, '');
      r = r.replace(/^disable-on-power-save=.*\n?/gm, '');
      r = r.replace(/^.*-preview-.*\n?/gm, '');
      r = r.replace('[/]\n', '');
      r = r.trim();

      // There were some inconsistencies in the key names. The update fixes them.
      r.replace('flame-', 'fire-');
      r.replace('claw-', 'trex-');

      // Find all effects which were used for openeing and closing. This first extracts
      // all lines which end in "-open-effect=true" and then remove this suffix from the
      // lines. This leaves only the effect nicks.
      let lines       = r.split('\n');
      let openEffects = lines.filter(l => l.includes('-open-effect=true'))
                          .map(l => l.replace('-open-effect=true', ''));
      let closeEffects = lines.filter(l => l.includes('-close-effect=true'))
                           .map(l => l.replace('-close-effect=true', ''));

      // The fire-close effect is enabled per default, so we have to add it if it's not
      // explicitly disabled.
      if (!r.includes('fire-close-effect=false') && !closeEffects.includes('fire')) {
        closeEffects.push('fire');
      }

      // Print all effects we've found.
      utils.debug('Enabled open effects: ' + openEffects);
      utils.debug('Enabled close effects: ' + closeEffects);

      // If the same effects were used for opening and closing windows or there is either
      // no opening or no closing animation configured, only one profile is required. Else
      // we have to create two new profiles.
      const numProfiles = openEffects.join() == closeEffects.join() ? 1 : 2;
      if (numProfiles == 1) {
        utils.debug('Only one profile is required.');
      } else if (closeEffects.length == 0) {
        utils.debug('Only a window-open profile is required.');
      } else if (openEffects.length == 0) {
        utils.debug('Only a window-close profile is required.');
      } else {
        utils.debug('Two profiles are required.');
      }

      // Remove all open / close lines.
      const profileLines =
        lines.filter(l => !l.includes('-close-effect=') && !l.includes('-open-effect='));

      // Add the header.
      profileLines.unshift('[burn-my-windows-profile]');

      // Push the line which makes the profile only apply to normal windows.
      if (!destroyDialogs) {
        profileLines.push('profile-window-type=1');
      }

      // Push the line which makes the profile only active when plugged in.
      if (disableOnBattery) {
        profileLines.push('profile-power-mode=2');
      }

      // Push the line which makes the profile only active when on balanced or performance
      // mode.
      if (disableOnPowerSave) {
        profileLines.push('profile-power-profile=5');
      }

      // Now comes a bit of code repetition, but it is more readable this way.
      if (numProfiles == 1) {

        // Add all relevant effects.
        openEffects.forEach(e => profileLines.push(e + '-enable-effect=true'));

        // The fire effect is enabled per default, so we have to explicitly disable it if
        // not required.
        if (!openEffects.includes('fire')) {
          profileLines.push('fire-enable-effect=false');
        }

        // Print and save the new profile.
        const profile = profileLines.join('\n');

        utils.debug('The new profile:');
        utils.debug(profile);

        profileManager.createProfile(profile);

      } else if (closeEffects.length == 0) {

        // This profile is only for window openeing.
        profileLines.push('profile-animation-type=1')

        // Add all relevant effects.
        openEffects.forEach(e => profileLines.push(e + '-enable-effect=true'));

        // The fire effect is enabled per default, so we have to explicitly disable it if
        // not required.
        if (!openEffects.includes('fire')) {
          profileLines.push('fire-enable-effect=false');
        }

        // Print and save the new profile.
        const profile = profileLines.join('\n');

        utils.debug('The new window-open profile:');
        utils.debug(profile);

        profileManager.createProfile(profile);

      } else if (openEffects.length == 0) {

        // This profile is only for window closing.
        profileLines.push('profile-animation-type=2')

        // Add all relevant effects.
        closeEffects.forEach(e => profileLines.push(e + '-enable-effect=true'));

        // The fire effect is enabled per default, so we have to explicitly disable it if
        // not required.
        if (!closeEffects.includes('fire')) {
          profileLines.push('fire-enable-effect=false');
        }

        // Print and save the new profile.
        const profile = profileLines.join('\n');

        utils.debug('The new window-close profile:');
        utils.debug(profile);

        profileManager.createProfile(profile);


      } else {

        const openProfileLines  = [...profileLines, 'profile-animation-type=1'];
        const closeProfileLines = [...profileLines, 'profile-animation-type=2'];

        // Add all relevant effects.
        openEffects.forEach(e => openProfileLines.push(e + '-enable-effect=true'));
        closeEffects.forEach(e => closeProfileLines.push(e + '-enable-effect=true'));

        // The fire effect is enabled per default, so we have to explicitly disable it if
        // not required.
        if (!closeEffects.includes('fire')) {
          closeProfileLines.push('fire-enable-effect=false');
        }

        if (!openEffects.includes('fire')) {
          openProfileLines.push('fire-enable-effect=false');
        }

        // Print and save the new profiles.
        const openProfile  = openProfileLines.join('\n');
        const closeProfile = closeProfileLines.join('\n');

        utils.debug('The new open-window profile:');
        utils.debug(openProfile);
        utils.debug('The new close-window profile:');
        utils.debug(closeProfile);

        profileManager.createProfile(openProfile);
        profileManager.createProfile(closeProfile);
      }
    })
    .catch(r => utils.debug('Failed to migrate settings: ' + r));
}