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

var GeneralPage = class GeneralPage extends PrefsPage {

  // ------------------------------------------------------------ constructor / destructor

  constructor(settings, builder) {
    super(settings, builder);

    this._builder.add_from_resource(
        `/ui/${utils.isGTK4() ? 'gtk4' : 'gtk3'}/generalPage.ui`);

    // Bind all properties.
    this._bindSwitch('destroy-dialogs');

    const stack = this._builder.get_object('main-stack');
    stack.add_titled(
        this._builder.get_object('general-prefs'), 'general', 'General Options');
  }

  // ---------------------------------------------------------------------- public methods
}