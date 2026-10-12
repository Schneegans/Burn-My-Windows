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
import Shell from 'gi://Shell';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

import * as utils from './utils.js';

//////////////////////////////////////////////////////////////////////////////////////////
// This is the base class for all shaders of Burn-My-Windows. It automagically loads    //
// the shader's source code from the resource file resources/shaders/<nick>.glsl and    //
// ensures that some standard uniforms are always updated.                              //
// Since GNOME 51, Shell.GLSLEffect has been removed from gnome-shell. On newer         //
// versions, we therefore use Clutter.ShaderEffect instead. It provides similar         //
// functionality: The GLSL snippet is cached per class (not per instance) and float     //
// uniforms can be set. The main difference is that uniforms are addressed by name      //
// instead of by location. To keep the rest of the code base unchanged,                 //
// get_uniform_location() returns the uniform's name as an opaque handle in this case,  //
// which is understood by set_uniform_float() and setUniform1i().                       //
//                                                                                      //
// The Shader fires three signals:                                                      //
//   * begin-animation:    This is called each time a new animation is started. It can  //
//                         be used to set uniform values which do not change during the //
//                         animation.                                                   //
//   * update-animation:   This is called at each frame during the animation. It can be //
//                         used to set uniforms which change during the animation.      //
//   * end-animation:      This is called when the animation is stopped. It can be      //
//                         used to clean up any resources.                              //
//////////////////////////////////////////////////////////////////////////////////////////

const _useShaderEffect = !Shell.GLSLEffect;

const _annotations = {
  Signals: {
    'begin-animation': {
      param_types: [
        Gio.Settings.$gtype, GObject.TYPE_BOOLEAN, GObject.TYPE_BOOLEAN,
        Clutter.Actor.$gtype
      ]
    },
    'update-animation': {param_types: [GObject.TYPE_DOUBLE]},
    'end-animation': {}
  }
};

// This is called from vfunc_paint_target() on both backends. It emits the update-
// animation signal, sets the blend mode of the pipeline and writes the progress uniform.
function _paintTarget(self) {
  self.emit('update-animation', self._progress);

  // Starting with GNOME 44.2, the alpha channel is not written to by default. We need
  // to undo this. It is a pity that we have to do this here, as it is not really
  // required to be done each frame. But it's the only place where we can do it.
  // https://gitlab.gnome.org/GNOME/gnome-shell/-/merge_requests/2650
  self.get_pipeline().set_blend(
    'RGBA = ADD (SRC_COLOR * (SRC_COLOR[A]), DST_COLOR * (1-SRC_COLOR[A]))');

  self.set_uniform_float(self._uProgress, 1, [self._progress]);
}

// Splits the given GLSL source code into the declarations (everything before "void main")
// and the body of the main function.
function _splitShaderCode(code) {
  // Match anything between the curly brackets of "void main() {...}".
  const regex = RegExp('void main *\\(\\) *\\{([\\S\\s]+)\\}');
  const match = regex.exec(code);

  return [code.substr(0, match.index), match[1]];
}

// This is called from the constructor of both backends after super._init() has been
// called. It sets up the standard uniforms and the timeline which drives the animation.
function _initRest(self) {
  // These will be updated during the animation.
  self._progress = 0;
  self._time     = 0;

  // Store standard uniform locations.
  self._uForOpening   = self.get_uniform_location('uForOpening');
  self._uIsFullscreen = self.get_uniform_location('uIsFullscreen');
  self._uProgress     = self.get_uniform_location('uProgress');
  self._uDuration     = self.get_uniform_location('uDuration');
  self._uSize         = self.get_uniform_location('uSize');
  self._uPadding      = self.get_uniform_location('uPadding');

  // Only used by layered effects (see LayeredEffect.js).
  self._uLayer     = self.get_uniform_location('uLayer');
  self._uLayerSize = self.get_uniform_location('uLayerSize');
  self._uTexRect   = self.get_uniform_location('uTexRect');

  // Shaders animating in lock-step with this one (see beginFollowing()).
  self._followers = [];
  self._leader    = null;

  // Create a timeline to drive the animation.
  self._timeline = new Clutter.Timeline();

  // Call updateAnimation() once a frame.
  self._timeline.connect('new-frame', (t) => {
    if (self._testMode) {
      self.updateAnimation(0.5);
    } else {
      self.updateAnimation(t.get_progress());
    }
  });

  // Clean up if the animation finished or was interrupted.
  self._timeline.connect('stopped', (t, finished) => {
    self.endAnimation();
  });
}

// The methods shared by both backends. They are added to the prototype of the class
// below before it is registered with GObject.
const _methods = {
  // This is called once each time the shader is used.
  beginAnimation(settings, forOpening, testMode, duration, actor) {
    if (this._timeline.is_playing()) {
      this._timeline.stop();
    }

    // On GNOME 3.36 this method was not yet available.
    if (this._timeline.set_actor) {
      this._timeline.set_actor(actor);
    }

    this._timeline.set_duration(duration);
    this._timeline.start();

    // Make sure that no fullscreen window is drawn over our animations. Since GNOME 48
    // this is a "global" method.
    if (Meta.disable_unredirect_for_display) {
      Meta.disable_unredirect_for_display(global.display);
    } else {
      global.compositor.disable_unredirect();
    }

    global.begin_work();

    // Reset progress value.
    this._progress = 0;
    this._testMode = testMode;

    this._setStandardUniforms(forOpening, duration, actor);

    this.emit('begin-animation', settings, forOpening, testMode, actor);
  },

  // For effects that draw on more than one actor (see LayeredEffect.js): makes this
  // shader animate in lock-step with `leader`, whose animation is started as usual with
  // beginAnimation(). This shader gets the same standard uniforms and its own
  // 'begin-animation' signal, but no timeline of its own: every progress update of the
  // leader is passed on to it. Call stopFollowing() when the leader's animation ends.
  beginFollowing(leader, settings, forOpening, testMode, duration, actor) {
    this.stopFollowing();
    this._leader = leader;
    leader._followers.push(this);

    this._progress = testMode ? 0.5 : 0;
    this._testMode = testMode;

    this._setStandardUniforms(forOpening, duration, actor);

    this.emit('begin-animation', settings, forOpening, testMode, actor);
  },

  stopFollowing() {
    if (this._leader) {
      const i = this._leader._followers.indexOf(this);
      if (i >= 0) this._leader._followers.splice(i, 1);
      this._leader = null;
    }
  },

  // The uniforms every shader gets at the start of an animation.
  _setStandardUniforms(forOpening, duration, actor) {
    // This is not necessarily symmetric, but I haven't figured out a way to
    // get the actual values...
    const padding    = (actor.width - actor.meta_window.get_frame_rect().width) / 2;
    let isFullscreen = actor.meta_window.fullscreen;

    // is_maximized has been added in GNOME 49.
    if (actor.meta_window.is_maximized) {
      isFullscreen |= actor.meta_window.is_maximized();
    } else {
      isFullscreen |= actor.meta_window.get_maximized() === Meta.MaximizeFlags.BOTH;
    }

    this.set_uniform_float(this._uPadding, 1, [padding]);
    this.set_uniform_float(this._uForOpening, 1, [forOpening]);
    this.set_uniform_float(this._uIsFullscreen, 1, [isFullscreen]);
    this.set_uniform_float(this._uDuration, 1, [duration * 0.001]);
    this.set_uniform_float(this._uSize, 2, [actor.width, actor.height]);
  },

  // This is called at each frame during the animation.
  updateAnimation(progress) {
    // Store the current progress value. The corresponding signal is emitted each frame
    // in vfunc_paint_target. We do not emit it here, as the pipeline which may be used
    // by handlers must not have been created yet.
    this._progress = progress;

    this.queue_repaint();

    for (const follower of this._followers) {
      follower.updateAnimation(progress);
    }
  },

  // This will stop any running animation and emit the end-animation signal.
  endAnimation() {
    // This will call endAnimation() again, so we can return for now.
    if (this._timeline.is_playing()) {
      this._timeline.stop();
      return;
    }

    // Restore unredirecting behavior for fullscreen windows. Since GNOME 48 this is a
    // "global" method.
    if (Meta.disable_unredirect_for_display) {
      Meta.enable_unredirect_for_display(global.display);
    } else {
      global.compositor.enable_unredirect();
    }
    global.end_work();

    this.emit('end-animation');
  },

  // Sets an integer uniform on the pipeline. This is used by some effects to bind texture
  // samplers. On newer versions, where uniforms are addressed by name, the location has
  // to be looked up first.
  setUniform1i(handle, value) {
    if (_useShaderEffect) {
      const pipeline = this.get_pipeline();
      pipeline.set_uniform_1i(pipeline.get_uniform_location(handle), value);
    } else {
      this.get_pipeline().set_uniform_1i(handle, value);
    }
  },

  // Where this effect's offscreen texture lies relative to the top-left corner of the
  // actor it is attached to, as [x, y, width, height] in that actor's coordinates, or
  // null before the first paint. `width` and `height` are the actor's size; its paint
  // volume must be its allocation (clip_to_allocation, as for the layers of
  // LayeredEffect.js).
  //
  // Only the size of the target is used. Its position is wherever the actor was painted
  // first this frame, which can be a clone of it inside another offscreen effect. The
  // origin follows from the actor's own size instead, the way Clutter pads the box
  // (_clutter_actor_box_enlarge_for_effects).
  //
  // texPadding: 'enlarged' (stock Clutter: x2' = ceil(x2 + 0.75), x1' = x2' - width, so
  // most of the 3px is on the left / top), 'centred' (padded evenly), or anything else
  // for no padding offset.
  getTextureRect(width, height, texPadding) {
    let w, h;
    try {
      if (this.get_target_rect) {
        const [ok, r] = this.get_target_rect();
        if (!ok) return null;
        w = r.get_width();
        h = r.get_height();
      } else {
        const [ok, tw, th] = this.get_target_size();
        if (!ok) return null;
        w = tw;
        h = th;
      }
    } catch (e) {
      return null;
    }
    if (!(w > 0 && h > 0)) return null;
    if (texPadding === 'centred') {
      return [-(w - width) / 2, -(h - height) / 2, w, h];
    }
    if (texPadding === 'enlarged') {
      return [Math.ceil(width + 0.75) - w, Math.ceil(height + 0.75) - h, w, h];
    }
    return [0, 0, w, h];
  },

  // --------------------------------------------------------------------- private stuff

  // This loads a GLSL file from the extension's resources to a JavaScript string. The
  // code from "common.glsl" is prepended automatically.
  _loadShaderResource(path) {
    let common = utils.getStringResource('/shaders/common.glsl');
    let code   = utils.getStringResource(path);

    // Add a trailing newline. Else the GLSL compiler complains...
    return common + '\n' + code + '\n';
  }
};

// On newer versions, uniforms are addressed by name. We return the name as an opaque
// handle which is understood by set_uniform_float() and setUniform1i().
if (_useShaderEffect) {
  _methods.get_uniform_location = function(name) {
    return name;
  };
}

let Shader;
if (_useShaderEffect) {
  class ShaderImpl extends Clutter.ShaderEffect {
    // The GLSL snippet (see vfunc_get_static_snippet()) is created lazily when the
    // effect is used for the first time.
    _init(nick) {
      this._nick = nick;

      super._init();

      _initRest(this);
    }

    // This is called once per class (not per instance) to create the GLSL snippet which
    // is then shared by all instances of this class.
    vfunc_get_static_snippet() {
      const code = this._loadShaderResource(`/shaders/${this._nick}.frag`);
      const [declarations, main] = _splitShaderCode(code);

      const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, declarations, null);
      snippet.set_replace(main);
      return snippet;
    }

    // We use this vfunc to trigger the update as it allows calling this.get_pipeline() in
    // the handlers. This could still be null if called from the updateAnimation() above.
    vfunc_paint_target(...params) {
      _paintTarget(this);
      super.vfunc_paint_target(...params);
    }

    // Clutter.ShaderEffect.set_uniform_float() ignores the component count and derives
    // the uniform's size from the length of the values array. Since parseColor() returns
    // four values, vec3 uniforms would be uploaded with four components, which is an
    // invalid glUniform4fv() call. The uniform would then be left at its default value
    // (typically black). We therefore cut the array to the declared size.
    set_uniform_float(name, n_components, values) {
      super.set_uniform_float(name, n_components, values.slice(0, n_components));
    }
  }

  Object.assign(ShaderImpl.prototype, _methods);
  Shader = GObject.registerClass(_annotations, ShaderImpl);
} else {
  class ShaderImpl extends Shell.GLSLEffect {
    // The constructor automagically loads the shader's source code (in
    // vfunc_build_pipeline()) from the resource file resources/shaders/<nick>.glsl
    // resolving any #includes in this file.
    _init(nick) {
      this._nick = nick;

      // This will call vfunc_build_pipeline().
      super._init();

      _initRest(this);
    }

    // This is called by the constructor. This means, it's only called when the
    // effect is used for the first time.
    vfunc_build_pipeline() {
      // Shell.GLSLEffect requires the declarations and the main source code as separate
      // strings. As it's more convenient to store the in one GLSL file, we use a regex
      // here to split the source code in two parts.
      const code = this._loadShaderResource(`/shaders/${this._nick}.frag`);
      const [declarations, main] = _splitShaderCode(code);

      this.add_glsl_snippet(
        Cogl.SnippetHook ? Cogl.SnippetHook.FRAGMENT : Shell.SnippetHook.FRAGMENT,
        declarations, main, true);
    }

    // We use this vfunc to trigger the update as it allows calling this.get_pipeline() in
    // the handlers. This could still be null if called from the updateAnimation() above.
    vfunc_paint_target(...params) {
      _paintTarget(this);
      super.vfunc_paint_target(...params);
    }
  }

  Object.assign(ShaderImpl.prototype, _methods);
  Shader = GObject.registerClass(_annotations, ShaderImpl);
}

export {Shader};
