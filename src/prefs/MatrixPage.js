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
const PrefsPage      = Me.imports.src.prefs.PrefsPage.PrefsPage;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

var MatrixPage = class MatrixPage extends PrefsPage {

  // ------------------------------------------------------------ constructor / destructor

  constructor(settings, builder) {
    super(settings, builder);

    this._builder.add_from_resource('/ui/gtk4/matrixPage.ui');

    // Bind all properties.
    this._bindAdjustment('matrix-animation-time');
    this._bindAdjustment('matrix-scale');
    this._bindAdjustment('matrix-randomness');
    this._bindColorButton('matrix-trail-color');
    this._bindColorButton('matrix-tip-color');

    const stack = this._builder.get_object('main-stack');
    stack.add_titled(this._builder.get_object('matrix-prefs'), 'matrix', 'Matrix');
  }

  // ---------------------------------------------------------------------- public methods

  getMinVersion() {
    return [40, 0];
  }

  getEnabledKey() {
    return 'matrix-close-effect';
  }

  getAnimationTime() {
    return this._settings.get_int('matrix-animation-time');
  }
}