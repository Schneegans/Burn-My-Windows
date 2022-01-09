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

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

var TRexPage = class TRexPage {

  // ---------------------------------------------------------------------- static methods

  static getMinShellVersion() {
    return [40, 0];
  }

  static getSettingsPrefix() {
    return 'trex';
  }

  static getLabel() {
    return 'T-Rex Attack';
  }

  static initPreferences(dialog) {

    dialog.getBuilder().add_from_resource('/ui/gtk4/trexPage.ui');

    // Bind all properties.
    dialog.bindAdjustment('trex-animation-time');
    dialog.bindColorButton('claw-scratch-color');
    dialog.bindAdjustment('claw-scratch-scale');
    dialog.bindAdjustment('claw-scratch-count');
    dialog.bindAdjustment('claw-scratch-warp');

    const stack = dialog.getBuilder().get_object('main-stack');
    stack.add_titled(
        dialog.getBuilder().get_object('trex-prefs'), 'trex', 'T-Rex Attack');
  }
}