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

var MatrixPage = class MatrixPage {

  // ---------------------------------------------------------------------- static methods

  static getMinShellVersion() {
    return [40, 0];
  }

  static getSettingsPrefix() {
    return 'matrix';
  }

  static getLabel() {
    return 'Matrix';
  }

  static initPreferences(dialog) {

    dialog.getBuilder().add_from_resource('/ui/gtk4/matrixPage.ui');

    // Bind all properties.
    dialog.bindAdjustment('matrix-animation-time');
    dialog.bindAdjustment('matrix-scale');
    dialog.bindAdjustment('matrix-randomness');
    dialog.bindColorButton('matrix-trail-color');
    dialog.bindColorButton('matrix-tip-color');

    const stack = dialog.getBuilder().get_object('main-stack');
    stack.add_titled(dialog.getBuilder().get_object('matrix-prefs'), 'matrix', 'Matrix');
  }
}