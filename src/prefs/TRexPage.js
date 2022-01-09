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
const PrefsPage      = Me.imports.src.prefs.PrefsPage.PrefsPage;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

var TRexPage = class TRexPage extends PrefsPage {

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

  // ------------------------------------------------------------ constructor / destructor

  constructor(settings, builder) {
    super(settings, builder);

    this._builder.add_from_resource('/ui/gtk4/trexPage.ui');

    // Bind all properties.
    this._bindAdjustment('trex-animation-time');
    this._bindColorButton('claw-scratch-color');
    this._bindAdjustment('claw-scratch-scale');
    this._bindAdjustment('claw-scratch-count');
    this._bindAdjustment('claw-scratch-warp');

    const stack = this._builder.get_object('main-stack');
    stack.add_titled(this._builder.get_object('trex-prefs'), 'trex', 'T-Rex Attack');
  }
}