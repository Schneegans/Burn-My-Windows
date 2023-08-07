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
import GLib from 'gi://GLib';

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

// This method can be used to write a message to GNOME Shell's log. This is enhances
// the standard log() functionality by prepending the extension's name and the location
// where the message was logged. As the extensions name is part of the location, you
// can more effectively watch the log output of GNOME Shell:
// journalctl -f -o cat | grep -E 'burn-my-windows|'
export function debug(message) {
  const stack = new Error().stack.split('\n');

  // Remove debug() function call from stack.
  stack.shift();

  log('[' + stack[0] + '] ' + message);
}

// Currently, the extension supports only one set of UI files. In the past, there were
// three different sets for GTK3, GTK4, and Adwaita. This method returns the name of the
// current UI directory. It's still here since it might be useful in the future.
export function getUIDir() {
  return 'adw';
}

// This method returns true if the current GNOME Shell version matches the given
// arguments.
export function shellVersionIs(major, minor) {
  return GS_MAJOR == major && GS_MINOR == toNumericVersion(minor);
}

// This method returns true if the current GNOME Shell version is at least as high as the
// given arguments. Supports "alpha" and "beta" for the minor version number.
export function shellVersionIsAtLeast(major, minor) {
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
export function getStringResource(path) {
  const data = Gio.resources_lookup_data(path, 0);
  return new TextDecoder().decode(data.get_data());
}

// Executes a command asynchronously and returns the output from 'stdout' on success or
// throw an error with output from 'stderr' on failure. If given, input will be passed to
// 'stdin' and cancellable can be used to stop the process before it finishes.
// This is directly taken from here:
// https://gjs.guide/guides/gio/subprocesses.html#complete-examples
export async function executeCommand(argv, input = null, cancellable = null) {
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
