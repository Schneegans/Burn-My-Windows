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
// SPDX-FileCopyrightText: Aurélien Hamy <aunetx@yandex.com>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as LookingGlass from 'resource:///org/gnome/shell/ui/lookingGlass.js';

import * as utils from './utils.js';

//////////////////////////////////////////////////////////////////////////////////////////
// This is based on the window-picking functionality of the Blur-My-Shell extension.    //
// The PickWindow() method is exposed via the D-Bus and can be called by the            //
// preferences dialog of the Burn-My-Windows extensions in order to initiate the window //
// picking.                                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

export class WindowPicker {
  // ------------------------------------------------------------------------- constructor

  constructor() {
    const iFace = utils.getStringResource(
      '/interfaces/org.gnome.shell.extensions.burn-my-windows.xml');
    this._dbus = Gio.DBusExportedObject.wrapJSObject(iFace, this);
  }

  // --------------------------------------------------------------------- D-Bus interface

  // This method is exposed via the D-Bus. It is called by the preferences dialog of the
  // Burn-My-Windows extensions in order to initiate the window picking.
  PickWindow() {

    // We use the actor picking from LookingGlass. This seems a bit hacky and also allows
    // selecting things of the Shell which are not windows, but it does the trick :)
    const lookingGlass = Main.createLookingGlass();
    lookingGlass.open();
    lookingGlass.hide();

    const inspector = new LookingGlass.Inspector(Main.createLookingGlass());
    inspector.connect('target', (me, target, x, y) => {
      // Remove border effect when window is picked.
      target.get_effects()
        .filter(e => e.toString().includes('lookingGlass_RedBorderEffect'))
        .forEach(e => target.remove_effect(e));

      if (target.toString().includes('MetaSurfaceActor')) {
        target = target.get_parent();
      }

      if (target.toString().includes('ContainerActor')) {
        target = target.get_parent();
      }

      let wmClass = 'window-not-found';
      if (target.toString().includes('WindowActor') &&
          target.meta_window.get_wm_class() != '') {
        wmClass = target.meta_window.get_wm_class();
      }

      this._dbus.emit_signal('WindowPicked', new GLib.Variant('(s)', [wmClass]));
    });

    // Close LookingGlass when we're done.
    inspector.connect('closed', _ => lookingGlass.close());
  }

  // -------------------------------------------------------------------- public interface

  // Call this to make the window-picking API available on the D-Bus.
  export() {
    this._dbus.export(Gio.DBus.session, '/org/gnome/shell/extensions/BurnMyWindows');
  }

  // Call this to stop this D-Bus again.
  unexport() {
    this._dbus.unexport();
  }
};
