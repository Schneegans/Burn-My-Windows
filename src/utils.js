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

const {Gtk} = imports.gi;

const Config               = imports.misc.config;
const [GS_MAJOR, GS_MINOR] = Config.PACKAGE_VERSION.split('.');

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();

// This method can be used to write a message to GNOME Shell's log. This is enhances
// the standard log() functionality by prepending the extension's name and the location
// where the message was logged. As the extensions name is part of the location, you
// can more effectively watch the log output of GNOME Shell:
// journalctl -f -o cat | grep -E 'particle-effects|'
// This method is based on a similar script from the Fly-Pie GNOME Shell extension which
// os published under the MIT License (https://github.com/Schneegans/Fly-Pie).
function debug(message) {
  const stack = new Error().stack.split('\n');

  // Remove debug() function call from stack.
  stack.shift();

  // Find the index of the extension directory (e.g. particles@schneegans.github.com) in
  // the stack entry. We do not want to print the entire absolute file path.
  const extensionRoot = stack[0].indexOf(Me.metadata.uuid);

  log('[' + stack[0].slice(extensionRoot) + '] ' + message);
}

// This method simply returns true if we are currently using GTK4.
function isGTK4() {
  return Gtk.get_major_version() == 4;
}

// This method returns 'gtk3' or 'gtk4' depending on the currently used gtk version.
function getGTKString() {
  return isGTK4() ? 'gtk4' : 'gtk3';
}

// This method returns true if called in GNOME Shell's process, false if called in the
// preferences process.
function isInShellProcess() {
  return window.global && global.stage;
}

// This method returns true if the current GNOME Shell version matches the given
// arguments.
function shellVersionIs(major, minor) {
  return GS_MAJOR == major && GS_MINOR == minor;
}

// This method returns true if the current GNOME Shell version is at least as high as the
// given arguments.
function shellVersionIsAtLeast(major, minor) {
  if (GS_MAJOR > major) {
    return true;
  }

  if (GS_MAJOR == major) {
    if (minor == 'alpha') return true;
    if (minor == 'beta' && GS_MINOR == 'alpha') return false;
    if (minor == 'beta' && GS_MINOR == 'beta') return true;

    return GS_MINOR >= minor;
  }

  return false;
}