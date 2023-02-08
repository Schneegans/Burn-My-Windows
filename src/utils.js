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

const {Gtk, Gio} = imports.gi;
const ByteArray  = imports.byteArray;

// libadwaita is available starting with GNOME Shell 42.
let Adw = null;
try {
  Adw = imports.gi.Adw;
} catch (e) {
  // Nothing to do.
}

// Returns the given argument, except for "alpha", "beta", and "rc". In these cases -3,
// -2, and -1 are returned respectively.
function toNumericVersion(x) {
  switch (x) {
    case 'alpha':
      return -3;
    case 'beta':
      return -2;
    case 'rc':
      return -1;
  }
  return x;
}

const Config               = imports.misc.config;
const [GS_MAJOR, GS_MINOR] = Config.PACKAGE_VERSION.split('.').map(toNumericVersion);

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();

const _ = imports.gettext.domain('burn-my-windows').gettext;

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

// Starting with GNOME Shell 42, the settings dialog uses libadwaita (at least most of
// the time - it seems that pop!_OS does not support libadwaita even on GNOME 42).
function isADW() {
  return Adw && shellVersionIsAtLeast(42, 'beta');
}

// This method returns 'gtk3', 'gtk4', or 'adw' depending on the currently used GTK / and
// or libadwaita version.
function getUIDir() {
  return isADW() ? 'adw' : (isGTK4() ? 'gtk4' : 'gtk3');
}

// This method returns true if the current GNOME Shell version matches the given
// arguments.
function shellVersionIs(major, minor) {
  return GS_MAJOR == major && GS_MINOR == toNumericVersion(minor);
}

// This method returns true if the current GNOME Shell version is at least as high as the
// given arguments. Supports "alpha" and "beta" for the minor version number.
function shellVersionIsAtLeast(major, minor) {
  if (GS_MAJOR > major) {
    return true;
  }

  if (GS_MAJOR == major) {
    return GS_MINOR >= toNumericVersion(minor);
  }

  return false;
}

// Reads the contents of a file contained in the global resources archive. The data
// is returned as a string.
function getStringResource(path) {
  const data = Gio.resources_lookup_data(path, 0);
  return ByteArray.toString(ByteArray.fromGBytes(data));
}

// Executes a command asynchronously and returns the output from 'stdout' on success or
// throw an error with output from 'stderr' on failure. If given, input will be passed to
// 'stdin' and cancellable can be used to stop the process before it finishes.
// This is directly taken from here:
// https://gjs.guide/guides/gio/subprocesses.html#complete-examples
async function executeCommand(argv, input = null, cancellable = null) {
  let cancelId = 0;
  let flags    = (Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

  if (input !== null) flags |= Gio.SubprocessFlags.STDIN_PIPE;

  let proc = new Gio.Subprocess({argv: argv, flags: flags});
  proc.init(cancellable);

  if (cancellable instanceof Gio.Cancellable) {
    cancelId = cancellable.connect(() => proc.force_exit());
  }

  return new Promise((resolve, reject) => {
    proc.communicate_utf8_async(input, null, (proc, res) => {
      try {
        let [, stdout, stderr] = proc.communicate_utf8_finish(res);
        let status = proc.get_exit_status();

        if (status !== 0) {
          throw new Gio.IOErrorEnum({
            code: Gio.io_error_from_errno(status),
            message: stderr ? stderr.trim() : GLib.strerror(status)
          });
        }

        resolve(stdout.trim());
      } catch (e) {
        reject(e);
      } finally {
        if (cancelId > 0) {
          cancellable.disconnect(cancelId);
        }
      }
    });
  });
}
