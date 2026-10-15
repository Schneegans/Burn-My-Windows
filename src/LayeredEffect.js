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

// SPDX-FileCopyrightText: Kevin Langman <klangman@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';

import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

//////////////////////////////////////////////////////////////////////////////////////////
// The standard layer set-up for effects that draw on more than just the window (e.g.   //
// Aperture Panels, Morph, Wormhole). A shader only sees the texture of the actor it is //
// attached to, so these effects hide the window and stack their own actors over it,   //
// drawn after all windows. Bottom to top:                                              //
//   wall    = (optional, no shader) black, or the wallpaper                            //
//   surface = what's behind the window: the windows behind, and the wallpaper unless   //
//             it is on the wall. A second shader instance follows the window's shader  //
//             (uLayer = 0)                                                             //
//   window  = a clone of the window itself, with its shadow (extension.js's shader,    //
//             uLayer = 1)                                                              //
//   above   = clones of the windows above the window (no shader)                       //
//                                                                                      //
// An effect's createLayers(actor, shader, ctx) hook (called by extension.js) just      //
// returns LayeredEffect.create(...). This builds the layers, sets uLayer, uLayerSize   //
// and uTexRect on both shaders (see common.glsl), follows the window's geometry and    //
// the stacking order once a frame, and cleans up. The effect only says how big the     //
// layers must be and sets its own uniforms.                                            //
//                                                                                      //
// Everything layered effects need lives in this file, so extension.js only has to      //
// call createLayers(), attach the shader to the returned paintTarget and call          //
// destroy() at the end. When submitted this file was in sync with LayeredEffect.js     //
// of the Cinnamon version of Burn My Windows (CinnamonBurnMyWindows).                  //
//////////////////////////////////////////////////////////////////////////////////////////

// px around the window actor (and frame) always covered, for its shadow. Windows just
// outside the layers count as overlapping them by this much, too.
const SHADOW_MARGIN = 64;

// How Clutter splits the 3px of padding of an offscreen effect's texture. Stock Clutter
// (_clutter_actor_box_enlarge_for_effects): x2' = ceil(x2 + 0.75), x1' = x2' - width, so
// most of it is on the left / top. See Shader.getTextureRect().
const TEX_PADDING = 'enlarged';

// Marks our actors in the window group's parent (see insertAboveWindows()).
const LAYER_MARK = '_bmwEffectLayer';

// Clutter.Color was removed in GNOME 47 in favour of Cogl.Color.
function black() {
  return Clutter.Color ? Clutter.Color.from_string('black')[1] :
                         Cogl.Color.from_string('black')[1];
}

// ---------------------------------------------------------------------------- helpers

// Puts `actors` (bottom to top) where layered effects put their actors: in the window
// group's parent (Main.layoutManager.uiGroup), right above the window group. Not inside
// the window group: while Mutter paints it, it limits each window to its unobscured /
// freshly damaged region, and clones painted in that same pass inherit the limit (holes
// and flashing). Above it, they are painted after all windows but still below the
// overview, the panel, menus and popups (global.top_window_group), as a window would be.
// They also go above any other effect's actors that are still there, so the newest
// animation, which has cloned those into its own layers, is drawn on top.
export function insertAboveWindows(actors) {
  const wg    = global.window_group;
  let parent  = wg ? wg.get_parent() : null;
  let sibling = wg;
  if (!parent) {
    parent  = Main.layoutManager.uiGroup;
    sibling = null;
  }
  while (sibling && sibling.get_next_sibling() &&
         sibling.get_next_sibling()[LAYER_MARK]) {
    sibling = sibling.get_next_sibling();
  }
  for (const a of actors) {
    a[LAYER_MARK] = true;
    if (sibling) {
      parent.insert_child_above(a, sibling);
    } else {
      parent.add_child(a);
    }
    sibling = a;
  }
}

// Adds a clone of any actor to `layer`, whose top-left is at ox, oy on the stage.
export function addClone(layer, source, ox, oy) {
  const [sx, sy] = source.get_transformed_position();
  layer.add_child(new Clutter.Clone(
    {source: source, reactive: false, x: Math.round(sx - ox), y: Math.round(sy - oy)}));
}

// Adds a clone of window actor `wa` to `layer`, whose top-left is at ox, oy on the stage.
// - Placed by wa.x / y: at map time the transformed position can still report the old
//   allocation.
// - A clone ignores its source's opacity, so the clone follows the window's opacity
//   (0 while the window is hidden by an effect of its own).
// - If the window is being animated by a layered effect, its effect actor is cloned on
//   top, so that animation shows through ours. Once it ends that clone goes blank and
//   the window clone (opacity back to 255) takes over.
export function addWindowClone(layer, wa, ox, oy) {
  const clone = new Clutter.Clone(
    {source: wa, reactive: false, x: Math.round(wa.x - ox), y: Math.round(wa.y - oy)});
  wa.bind_property('opacity', clone, 'opacity', GObject.BindingFlags.SYNC_CREATE);
  layer.add_child(clone);
  if (wa._bmwEffectContainer) {
    addClone(layer, wa._bmwEffectContainer, ox, oy);
  }
}

// Keeps track of which windows are above and below `actor` while its clone layers are
// built, and says when that changed (takeDirty(), checked once a frame). That includes
// the windows near the area last asked about (windowsNear()) moving, resizing, showing
// or hiding, or moving into or out of it: their clones are placed once, when the layers
// are built, so the layers must be rebuilt then.
// - Normally that's simply the order of the window actors.
// - But while a window disappears (close, `disappearing`), Mutter keeps its actor where
//   it was until the animation ends, even above windows raised meanwhile. So a window
//   raised during the animation is treated as above it, together with everything stacked
//   above that window. Two ways to notice:
//   * its 'raised' signal (clicking an unfocused window, Alt-Tab, ...);
//   * a mouse button pressed over it (on X11, clicking the window that already has the
//     focus doesn't raise it). The pointer state is polled once a frame.
//   Anything before the animation's first frame (frame()) doesn't count: that's Mutter
//   passing the focus on because this window is going away, and putting that window on
//   top would hide most of the animation. Focus changes alone don't count either
//   (focus-follows-mouse doesn't raise), nor does the desktop.
// windowsNear(rect, above): the visible windows below (above = false) or above
// (above = true) `actor` that intersect `rect`. Windows just outside `rect` count too, as
// their shadow may reach into it (the layers are opaque, so the real one is hidden
// there).
export function createStackTracker(actor, disappearing) {
  const self     = actor.get_meta_window();
  const raised   = new Set();  // MetaWindows raised during the animation
  const ids      = new Map();  // window actor -> small number, for the stacking signature
  const handlers = [];         // [object, handler id]
  let watching   = false;
  let lastSig    = null;
  let lastRect   = null;  // the area of the last windowsNear() call

  const BUTTONS = Clutter.ModifierType.BUTTON1_MASK | Clutter.ModifierType.BUTTON2_MASK |
    Clutter.ModifierType.BUTTON3_MASK;
  const buttonsDown = () => {
    const [x, y, mods] = global.get_pointer();
    return [x, y, (mods & BUTTONS) !== 0];
  };
  // A button already held when the animation starts (e.g. the click that closed the
  // window) is not a new click.
  let buttonWasDown = buttonsDown()[2];

  // The window a click at x, y went to, or null (the panel, a menu, the desktop, ...).
  const clickedWindow = (x, y) => {
    // Chrome (panel, menus) is above the windows and reactive; don't look further.
    const picked = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
    if (picked && picked !== global.stage && !global.window_group.contains(picked)) {
      return null;
    }
    const actors = global.get_window_actors().filter(a => a !== actor);
    for (let i = actors.length - 1; i >= 0; i--) {
      const wa = actors[i];
      if (!wa.visible) continue;
      const mw = wa.get_meta_window();
      if (!mw || mw.minimized) continue;
      const f = mw.get_frame_rect();
      if (x >= f.x && x < f.x + f.width && y >= f.y && y < f.y + f.height) {
        return mw.get_window_type() === Meta.WindowType.DESKTOP ? null : mw;
      }
    }
    return null;
  };

  if (disappearing) {
    for (const wa of global.get_window_actors()) {
      const mw = wa.get_meta_window();
      if (!mw || mw === self) continue;
      try {
        handlers.push([
          mw,
          mw.connect('raised',
                     () => {
                       if (watching && mw.get_window_type() !== Meta.WindowType.DESKTOP)
                         raised.add(mw);
                     })
        ]);
      } catch (e) {
        // No 'raised' signal: windows raised meanwhile stay below.
      }
    }
  }

  const orderOf = () => {
    const actors = global.get_window_actors();
    const idx    = actors.indexOf(actor);
    const others = actors.filter(a => a !== actor);
    const onTop  = new Set(idx >= 0 ? actors.slice(idx + 1) : []);
    const first  = others.findIndex(a => {
      try {
        return raised.has(a.get_meta_window());
      } catch (e) {
        return false;
      }
     });
    if (first >= 0) others.slice(first).forEach(a => onTop.add(a));
    return {others, onTop};
  };

  // Whether window actor `wa` is close enough to `rect` for its shadow to reach into it.
  const isNear = (wa, rect) => {
    const M = SHADOW_MARGIN;
    return wa.x - M < rect.x + rect.width && wa.x + wa.width + M > rect.x &&
      wa.y - M < rect.y + rect.height && wa.y + wa.height + M > rect.y;
  };

  // Which windows are above / below, plus where the windows near lastRect are, as a
  // string, to notice changes. Windows elsewhere on the screen can move freely without
  // causing a rebuild.
  const signature = () => {
    const {others, onTop} = orderOf();
    const id = (a) => {
      if (!ids.has(a)) ids.set(a, ids.size + 1);
      return ids.get(a);
    };
    return others
      .map(a => {
        let s = (onTop.has(a) ? '+' : '-') + id(a);
        if (lastRect && a.visible && isNear(a, lastRect)) {
          s += `@${a.x},${a.y},${a.width}x${a.height}`;
        }
        return s;
      })
      .join(',');
  };
  // The layers are built right after this with the same order.
  lastSig = signature();

  return {
    frame: () => {
      watching = true;
      if (!disappearing) return;
      const [x, y, down] = buttonsDown();
      if (down && !buttonWasDown) {
        const mw = clickedWindow(x, y);
        if (mw && mw !== self) raised.add(mw);
      }
      buttonWasDown = down;
    },

    // True when the windows above / below, or the place of the windows near the layers,
    // changed since the last call (or since the layers were last built). Checked every
    // frame rather than on 'restacked' / 'position-changed'.
    takeDirty: () => {
      const sig     = signature();
      const changed = sig !== lastSig;
      lastSig       = sig;
      return changed;
    },

    // Called while (re)building the layers, so what it returns is what they now show:
    // from here on, changes are measured against that.
    windowsNear: (rect, above) => {
      lastRect = {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
      lastSig  = signature();
      const {others, onTop} = orderOf();
      return others.filter(wa => onTop.has(wa) === above && wa.visible &&
                             isNear(wa, lastRect));
    },

    destroy: () => {
      for (const [obj, id] of handlers) {
        try {
          obj.disconnect(id);
        } catch (e) {
          // The window is gone already.
        }
      }
      handlers.length = 0;
      ids.clear();
      raised.clear();
    }
  };
}

// Moves / resizes window actor `actor` to its window's buffer rect. Mutter doesn't do
// this while an effect runs on the actor; see the per-frame code of
// LayeredEffect.create().
export function followBufferRect(actor, metaWindow) {
  const b = metaWindow.get_buffer_rect();
  if (actor.x !== b.x || actor.y !== b.y) {
    actor.set_position(b.x, b.y);
  }
  if (actor.width !== b.width || actor.height !== b.height) {
    actor.set_size(b.width, b.height);
  }
}

// ------------------------------------------------------------------------ LayeredEffect

export default class LayeredEffect {
  // actor, shader, ctx: as passed to the effect's createLayers() by extension.js. ctx
  // holds settings (the profile's Gio.Settings), forOpening, testMode and duration (ms).
  //
  // opts:
  //   factory:       the effect's ShaderFactory, for the surface's shader.
  //   wall:          true: an unshaded black layer below the surface (it shows through
  //                  wherever the surface is transparent).
  //   desktopOnWall: true: the wallpaper goes on the wall (it stays put while the
  //                  surface animates). Implies wall. Otherwise it is part of the
  //                  surface.
  //   noWallpaper:   true: the wallpaper is not drawn at all.
  //   opaqueSurface: true: the surface is black under its contents, so nothing the
  //                  effect reveals ever shows the real screen through it.
  //   geometry(frame, actor, stageW, stageH):
  //                  optional. frame (the visible window) and actor are {x, y, width,
  //                  height} in stage coordinates. Returns an object whose `cover` (a
  //                  list of stage rects) the layers must cover besides the window and
  //                  its shadow; any other fields are copied into the geometry `g` below.
  //                  Called every frame while opening, once while closing.
  //   init(shader):  optional. Called once for each of the two shaders: set the uniforms
  //                  that never change (settings, random picks), identically on both.
  //   onGeometry(shader, g):
  //                  optional. Called for each shader whenever the geometry changed. g
  //                  has ox, oy (the layers' top-left on the stage), OW, OH (their size),
  //                  frame ({x, y, width, height} of the visible window, in layer
  //                  coordinates) and the fields from geometry().
  //
  // Returns what extension.js expects from createLayers(): {paintTarget, destroy}.
  static create(actor, shader, ctx, opts) {
    const windowShader  = shader;
    const surfaceShader = opts.factory.getShader();
    const shaders       = [surfaceShader, windowShader];

    // Which windows are above / below this one.
    const stack = createStackTracker(actor, !ctx.forOpening);

    const group    = new Clutter.Actor({reactive: false});
    const newLayer = (props = {}) => {
      const layer = new Clutter.Actor(
        Object.assign({clip_to_allocation: true, reactive: false}, props));
      group.add_child(layer);
      return layer;
    };
    const wall =
      (opts.wall || opts.desktopOnWall) ? newLayer({background_color: black()}) : null;
    const surface = newLayer(opts.opaqueSurface ? {background_color: black()} : {});
    const win     = newLayer();
    const above   = newLayer();
    const layers  = [wall, surface, win, above].filter(l => l);

    // Window geometry. While opening it's read every frame (the window may still be
    // placed or resized). While closing it's taken once, now: when a maximized window
    // closes, the frame may be moved to its saved unmaximized rectangle while the actor
    // keeps showing the maximized window, so later reads would be wrong.
    const readWindow = () => {
      const f = actor.get_meta_window().get_frame_rect();
      return {
        frame: {x: f.x, y: f.y, width: f.width, height: f.height},
        actor: {x: actor.x, y: actor.y, width: actor.width, height: actor.height}
      };
    };
    const frozen = ctx.forOpening ? null : readWindow();

    // Our own wallpaper actors, positioned in stage coordinates. Mutter clips the shell's
    // background actors to the area not covered by opaque windows, so cloning those
    // leaves holes wherever a window is on top.
    const wallpaper        = new Clutter.Actor({reactive: false});
    const bgManagers       = [];
    let wallpaperAvailable = false;
    if (!opts.noWallpaper) {
      try {
        for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
          bgManagers.push(new Background.BackgroundManager(
            {container: wallpaper, monitorIndex: i, vignette: false}));
        }
        wallpaperAvailable = true;
      } catch (e) {
        bgManagers.forEach(m => m.destroy());
        bgManagers.length = 0;
      }
    }

    // Where the layers go: the window, its shadow and whatever the effect asks for,
    // trimmed to the screen (Clutter never renders anything off-screen into an effect's
    // texture). Not the paint volume: it's unreliable at map time and would make the
    // geometry change from one frame to the next. SHADOW_MARGIN covers the shadows.
    const geometry = () => {
      const w     = frozen || readWindow();
      const frame = w.frame;
      const act   = w.actor;
      const SW = global.stage.width, SH = global.stage.height;

      const extra = opts.geometry ? (opts.geometry(frame, act, SW, SH) || {}) : {};
      const rects = [frame, act]
                      .map(r => ({
                             x: r.x - SHADOW_MARGIN,
                             y: r.y - SHADOW_MARGIN,
                             width: r.width + 2 * SHADOW_MARGIN,
                             height: r.height + 2 * SHADOW_MARGIN
                           }))
                      .concat(extra.cover || []);
      const x1 = Math.max(0, Math.floor(Math.min(...rects.map(r => r.x))));
      const y1 = Math.max(0, Math.floor(Math.min(...rects.map(r => r.y))));
      const x2 = Math.min(SW, Math.ceil(Math.max(...rects.map(r => r.x + r.width))));
      const y2 = Math.min(SH, Math.ceil(Math.max(...rects.map(r => r.y + r.height))));

      const g = Object.assign({}, extra, {
        ox: x1,
        oy: y1,
        OW: Math.max(1, x2 - x1),
        OH: Math.max(1, y2 - y1),
        frame:
          {x: frame.x - x1, y: frame.y - y1, width: frame.width, height: frame.height},
        actorX: act.x,
        actorY: act.y
      });
      delete g.cover;
      g.key = JSON.stringify(g);
      return g;
    };

    // (Re)fill the layers with clones for geometry `g`.
    const populate = (g) => {
      group.set_position(g.ox, g.oy);
      group.set_size(g.OW, g.OH);
      if (wallpaper.get_parent()) wallpaper.get_parent().remove_child(wallpaper);
      for (const layer of layers) {
        layer.destroy_all_children();
        layer.set_size(g.OW, g.OH);
      }

      // Bottom to top: the wallpaper, then the windows behind. Which windows are below /
      // above is decided by the stack tracker (it knows about windows raised while this
      // one closes).
      const desk = opts.desktopOnWall ? wall : surface;
      if (wallpaperAvailable) {
        wallpaper.set_position(-g.ox, -g.oy);
        desk.add_child(wallpaper);
      } else if (!opts.noWallpaper) {
        const background = Main.layoutManager._backgroundGroup;
        if (background) addClone(desk, background, g.ox, g.oy);
      }

      const area      = {x: g.ox, y: g.oy, width: g.OW, height: g.OH};
      const behind    = stack.windowsNear(area, false);
      const isDesktop = (wa) =>
        wa.get_meta_window().get_window_type() === Meta.WindowType.DESKTOP;
      for (const wa of behind.filter(isDesktop)) {
        addWindowClone(desk, wa, g.ox, g.oy);
      }
      for (const wa of behind.filter(wa => !isDesktop(wa))) {
        addWindowClone(surface, wa, g.ox, g.oy);
      }

      // The window itself, at its real position so its shadow fits too. Placed by x / y:
      // at map time the transformed position can still report the old allocation.
      win.add_child(new Clutter.Clone({
        source: actor,
        reactive: false,
        x: Math.round(g.actorX - g.ox),
        y: Math.round(g.actorY - g.oy)
      }));

      for (const wa of stack.windowsNear(area, true)) {
        addWindowClone(above, wa, g.ox, g.oy);
      }

      for (const s of shaders) {
        s.set_uniform_float(s._uLayerSize, 2, [g.OW, g.OH]);
        s.set_uniform_float(s._uTexRect, 4,
                            [0, 0, g.OW, g.OH]);  // corrected once painted
        if (opts.onGeometry) opts.onGeometry(s, g);
      }
    };

    let geo = geometry();
    populate(geo);

    // After all windows, below the overview, the panel and menus.
    insertAboveWindows([group]);

    surfaceShader.set_uniform_float(surfaceShader._uLayer, 1, [0]);
    windowShader.set_uniform_float(windowShader._uLayer, 1, [1]);
    if (opts.init) shaders.forEach(s => opts.init(s));

    surface.add_effect_with_name('burn-my-windows-follower', surfaceShader);
    surfaceShader.beginFollowing(windowShader, ctx.settings, ctx.forOpening, ctx.testMode,
                                 ctx.duration, actor);

    // The offscreen texture is slightly larger than the layer (3px of padding). Read its
    // real size every frame (see Shader.getTextureRect()) so the pixel mapping is exact.
    const updateTexRect = (s) => {
      // Layer coordinates; the unpadded layer until the texture exists.
      const t = s.getTextureRect(geo.OW, geo.OH, TEX_PADDING);
      s.set_uniform_float(s._uTexRect, 4, t || [0, 0, geo.OW, geo.OH]);
    };
    const texRectIds =
      shaders.map(s => [s, s.connect('update-animation', () => updateTexRect(s))]);

    // Hide the real window; the clone still renders it. The effect container is set
    // first (and cleared first at the end), so code watching the window's opacity (e.g.
    // addWindowClone() of another animation) can tell a window hidden by an animation
    // from a hidden one, and clone the animation instead.
    actor._bmwEffectContainer = win;
    actor.opacity             = 0;

    let actorGone   = false;
    const destroyId = actor.connect('destroy', () => {
      actorGone = true;
    });

    // Once a frame, from the animation's timeline (before layout and painting, so actors
    // can safely be moved, created and destroyed). Never from notify::allocation:
    // destroying clones while their source window is being mapped crashes Clutter.
    // 1. Mutter doesn't move or resize a window actor while an effect runs on it, but
    //    the client can still change its buffer meanwhile (e.g. client-side shadow
    //    margins added right after mapping). Follow the buffer rect ourselves while the
    //    window appears. While it disappears, its content is its last frame, which
    //    doesn't change any more, while the client may already have changed its buffer.
    // 2. The layers follow the window (and the stacking order).
    const metaWindow = actor.get_meta_window();
    const onFrame = () => {
      stack.frame();
      if (actorGone) return;

      if (ctx.forOpening) followBufferRect(actor, metaWindow);

      const g     = geometry();
      const moved = g.key !== geo.key;
      if (moved) geo = g;
      const restacked = stack.takeDirty();
      if (moved || restacked) populate(geo);
    };
    const frameId = windowShader._timeline.connect('new-frame', onFrame);

    return {
      paintTarget: win,

      destroy: () => {
        windowShader._timeline.disconnect(frameId);
        for (const [s, id] of texRectIds) s.disconnect(id);
        if (!actorGone) {
          actor.disconnect(destroyId);
          actor._bmwEffectContainer = null;
          actor.opacity             = 255;
        }
        stack.destroy();
        surfaceShader.stopFollowing();
        surface.remove_effect(surfaceShader);
        surfaceShader.returnToFactory();
        bgManagers.forEach(m => m.destroy());
        wallpaper.destroy();
        group.destroy();  // also destroys the layers and clones
      }
    };
  }
}
