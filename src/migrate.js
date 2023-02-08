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

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;

function migrate() {
  utils.executeCommand(['dconf', 'dump', '/org/gnome/shell/extensions/burn-my-windows/'])
    .catch(r => utils.debug('Failed to get old settings for effect migration: ' + r))
    .then(r => {
      utils.debug('Starting Burn-My-Windows profile migration!');

      // Remove some unnecessary lines.
      r = r.replace(/^active-profile=.*\n?/gm, '');
      r = r.replace(/^test-mode=.*\n?/gm, '');
      r = r.replace(/^.*-preview-.*\n?/gm, '');
      r = r.replace('[/]\n', '');

      // There were some inconsistencies in the key names.
      r.replace('flame-', 'fire-');
      r.replace('claw-', 'trex-');

      let lines = r.split('\n');

      // Find all effects which were used for openeing and closing. This first extracts
      // all lines which end in "-open-effect=true" and then remove this suffix from the
      // lines. This leaves only the effect nicks.
      let openEffects = lines.filter(l => l.includes('-open-effect=true'))
                          .map(l => l.replace('-open-effect=true', ''));
      let closeEffects = lines.filter(l => l.includes('-close-effect=true'))
                           .map(l => l.replace('-close-effect=true', ''));

      // The fire effect is enabled per default, so we have to add it if it's not
      // explicitly disabled.
      if (!r.includes('fire-open-effect=false') && !openEffects.includes('fire')) {
        openEffects.push('fire');
      }

      if (!r.includes('fire-close-effect=false') && !closeEffects.includes('fire')) {
        closeEffects.push('fire');
      }

      utils.debug('Enabled open effects: ' + openEffects);
      utils.debug('Enabled close effects: ' + closeEffects);

      // If the same effects were used for opening and closing windows, only one profile
      // is required. Else we have to create two new profiles.
      const numProfiles = openEffects.join() == closeEffects.join() ? 1 : 2;
      if (numProfiles == 1) {
        utils.debug('Only one profile is required.');
      } else {
        utils.debug('Two profiles are required.');
      }

      // The default value of this is false, so if it is not present, only normal windows
      // were affected.
      const onlyNormalWindows = !r.includes('destroy-dialogs=true');
      if (onlyNormalWindows) {
        utils.debug('Only normal windows will be burned by the new profile(s).');
      } else {
        utils.debug('Normal windows and dialogs will be burned by the new profile(s).');
      }

      const profile =
        lines.filter(l => !l.includes('-close-effect=') && !l.includes('-open-effect='));
      profile.unshift('[burn-my-windows-profile]');
      if (onlyNormalWindows) {
        profile.push('profile-window-type=1');
      }

      if (numProfiles == 1) {
        openEffects.forEach(e => profile.push(e + '-enable-effect=true'));
        if (!openEffects.includes('fire')) {
          profile.push('fire-enable-effect=false');
        }

        utils.debug('The new profile:');
        utils.debug(profile.join('\n'));

      } else {

        const closeProfile = [...profile];
        const openProfile  = [...profile];

        openEffects.forEach(e => openProfile.push(e + '-enable-effect=true'));
        if (!openEffects.includes('fire')) {
          openProfile.push('fire-enable-effect=false');
        }

        closeEffects.forEach(e => closeProfile.push(e + '-enable-effect=true'));
        if (!closeEffects.includes('fire')) {
          closeProfile.push('fire-enable-effect=false');
        }

        utils.debug('The new open-window profile:');
        utils.debug(openProfile.join('\n'));
        utils.debug('The new close-window profile:');
        utils.debug(closeProfile.join('\n'));
      }
    })
    .catch(r => utils.debug('Failed migrate settings: ' + r));
}