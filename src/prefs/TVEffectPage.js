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

var TVEffectPage = class TVEffectPage {

  // ---------------------------------------------------------------------- static methods

  static getMinShellVersion() {
    return [3, 36];
  }

  static getSettingsPrefix() {
    return 'tv';
  }

  static getLabel() {
    return 'TV Effect';
  }

  static initPreferences(dialog) {

    dialog.getBuilder().add_from_resource(
        `/ui/${utils.isGTK4() ? 'gtk4' : 'gtk3'}/tvPage.ui`);

    // Bind all properties.
    dialog.bindAdjustment('tv-animation-time');
    dialog.bindColorButton('tv-effect-color');

    const stack = dialog.getBuilder().get_object('main-stack');
    stack.add_titled(dialog.getBuilder().get_object('tv-prefs'), 'tv', 'TV Effect');
  }
}