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

// The content from common.glsl is automatically prepended to each shader effect.

//////////////////////////////////////////////////////////////////////////////////////////
// Wormhole (see effects/Wormhole.js).                                                  //
//                                                                                      //
// The desktop is a rubber sheet that gets sucked into the screen around the window's   //
// centre. Its depth goes to infinity at a "throat", so the sheet turns into a tube     //
// that runs down to a vanishing point, and depth fog turns it black: the void is just  //
// where the desktop has curled away out of sight, there is no cut edge. A small        //
// version of the window lies on the sheet at the bottom of the void (same warp, fog   //
// and lighting as the desktop). As the sheet flattens, the tube's floor rises and     //
// pushes the window out while it grows to its real size (WINDOW_ON_SHEET; the older   //
// "window floats in the tube" mode is still there). Closing plays it backwards.       //
//                                                                                      //
// Two layers, same uniforms, bottom to top:                                            //
//   uLayer = 0  "surface": wallpaper + desktop + windows behind, flattened, warped     //
//   uLayer = 1  "window":  a clone of the window (with its shadow)                      //
//                                                                                      //
// Geometry is done in "portal space": v = (pixel - uCenter) / uAxes, and the distance  //
// from the centre is a superellipse norm of v (so the funnel follows the window's      //
// aspect ratio). The camera sits CAMERA_DIST above the centre looking straight down;   //
// a point at depth z below the screen is seen at v * CAMERA_DIST / (CAMERA_DIST + z).  //
//                                                                                      //
// Sheet depth at norm u:  gAmp * (1 - u)^2 / (u - gThroat)^THROAT_EXP                  //
//   (1 - u)^2 flattens smoothly into the desktop at u = 1 (no seam), and the division  //
//   sends the depth to infinity as u approaches the throat.                            //
//////////////////////////////////////////////////////////////////////////////////////////

// uLayer, uLayerSize and uTexRect, and getLayerPx(), are in common.glsl.
uniform vec2  uCenter;     // portal centre (= centre of the visible window), layer pixels
uniform vec2  uAxes;       // portal semi-axes in pixels (funnel reaches norm 1 there)
uniform vec2  uFrameHalf;  // half size of the visible window in pixels

// User settings (set by effects/Wormhole.js, identical on both layers):
uniform float uVoidSize;    // wormhole-void-size: throat radius on the sheet, bigger = wider void
uniform float uTunnelDepth; // wormhole-tunnel-depth: how far down the tube you can see (1 = default)
uniform float uBounce;      // wormhole-bounce: the bounce's restitution (BOUNCE_E below), 0 = no bounce

// ---- Tunables ----

const float SHAPE_POWER = 2.5;   // 2 = ellipse, higher = more like a rounded rectangle
const float CAMERA_DIST = 1.5;   // camera height (portal-space units); lower = stronger perspective
const float AMPLITUDE   = 0.5;   // overall depth of the funnel
const float THROAT_EXP  = 1.0;   // how sharply the sheet plunges near the throat

// The funnel keeps widening while the window rises (T_WIDEN). These are where each
// quantity starts, as a fraction of its final value:
const float AMP_START    = 0.6;   // of AMPLITUDE
const float THROAT_START = 0.35;  // of the void size (uVoidSize): the void grows from this
const float SPREAD_START = 0.55;  // of the funnel's full size (uAxes): it spreads outward
const float FOG_BASE    = 0.9;   // darkening per unit of depth at tunnel depth 1 (gFog = FOG_BASE / uTunnelDepth)
const float WALL_LIGHT  = 0.35;  // directional light on the funnel walls (0 = none)
const vec2  LIGHT_TO    = vec2(0.7071, 0.7071);  // light comes from the top-left

const float WIN_START_SIZE  = 0.03;  // the window's on-screen size when it starts rising
const float WIN_FOG_SCALE   = 0.5;   // the window's fog relative to the sheet's (so it shows sooner)
const float TUBE_FIT        = 0.9;   // the window fills this much of the tube's width where it sits

// true: the window is painted on the sheet itself, so it gets exactly the same warp, fog
// and lighting as the desktop and is carried up by the rising floor of the tube.
// false: the window floats in the tube, undistorted (WIN_START_SIZE, WIN_FOG_SCALE, TUBE_FIT).
const bool  WINDOW_ON_SHEET = true;
const float WIN_SHEET_START = 0.12;  // on the sheet: the window's size there when it starts rising

// The tube has a floor: while it's this low (FLOOR_START) the void looks bottomless. As the
// sheet flattens, the floor rises by FLOOR_RISE, closing the void from below and pushing
// the window out (without it a black pinhole stays until the very last frame).
const float FLOOR_START = 0.002;
const float FLOOR_RISE  = 1.0;

// Timeline (as fractions of gProgress; opening runs 0 -> 1).
// The sheet sinks and widens with no window in sight; as the window shows at the bottom of
// the void, the sheet starts flattening and the window rises with it, as if pushed out.
const vec2 T_SINK   = vec2(0.00, 0.30);  // the sheet is sucked in
const vec2 T_WIDEN  = vec2(0.05, 0.50);  // ...and keeps widening until the window shows
const vec2 T_APPEAR = vec2(0.38, 0.48);  // the window fades in (deep down, still in the dark)
const vec2 T_FLAT   = vec2(0.45, 1.00);  // the sheet flattens, pushing the window out...
const vec2 T_RISE   = vec2(0.40, 0.95);  // ...growing to its full size on screen

// Bounce (like Clutter.AnimationMode.EASE_OUT_BOUNCE): instead of easing to a stop, the
// sheet's flattening and the window's rise accelerate into the landing, then the sheet
// (and the window lying on it) dips back into a shallow dimple a few times, each bounce
// smaller and shorter.
// Physically consistent with the fall: a ball dropped over the T_FLAT span, which
// rebounds with uBounce of its speed (bounce height = uBounce^2 of the full stroke).
// The rest of the timeline is compressed to make room for the bounces.
// uBounce 0.5 with 3 bounces is exactly Clutter's EASE_OUT_BOUNCE shape. uBounce 0 turns
// the bounce off completely: the original eased (smoothstep) landing and timeline.
// Closing has its own bounce (not the open played backwards): after the window is gone,
// the funnel snaps flat (falling over T_SINK, its floor rising so the void closes from
// below instead of shrinking to a pinhole), then the desktop dips back in a few times,
// with the same dimple as the opening bounce.
const bool  BOUNCE          = true;   // opening
const bool  BOUNCE_ON_CLOSE = true;   // closing / minimizing
const int   BOUNCE_COUNT    = 3;
// true: the timeline before the landing phase (opening: until the sheet starts flattening,
// T_FLAT.x; closing: until the funnel starts collapsing, T_SINK.y) runs at its normal pace,
// and the landing phase (fall + bounces) is one EASE_OUT_BOUNCE curve over the time left.
// false: the whole timeline is sped up to make room for the bounces.
const bool  BOUNCE_KEEP_INTRO = true;
// Opening: 0 = the window lands at full size and stays there; only the sheet under it
// bounces, so the bounce shows as the window itself warping into the dimple and back
// (it lies on the sheet). 1 = the window also shrinks with each dip.
const float BOUNCE_WINDOW   = 0.0;

const int   SOLVE_STEPS = 24;  // bisection steps (depth changes fast near the throat)

// ---- Per-frame state, set at the start of main() ----

float gProgress;   // 0 = nothing of the window, 1 = the window at rest
float gAmp;        // current funnel amplitude (0 = flat)
float gThroat;     // current throat radius
float gFog;        // darkening per unit of depth (from uTunnelDepth)
float gFloor;      // current tube floor (see FLOOR_START)
float gSheetScale; // WINDOW_ON_SHEET: the window's scale on the sheet (1 = its real size)
vec2  gAxes;       // current funnel semi-axes in pixels (uAxes scaled by the spread)
float gWinDepth;   // the window's depth below the screen (only used for its fog)
float gWinSize;    // the window's on-screen scale (1 = its real size)
float gWinAlpha;

float shapeNorm(vec2 v) {
  vec2 a = abs(v);
  return pow(pow(a.x, SHAPE_POWER) + pow(a.y, SHAPE_POWER), 1.0 / SHAPE_POWER);
}

// Depth of the sheet at norm u. It plunges towards the throat, down to the floor.
float surfaceDepth(float u) {
  if (u >= 1.0 || gAmp <= 0.0) return 0.0;
  float d = max(u - gThroat, 0.0) + gFloor;
  return gAmp * (1.0 - u) * (1.0 - u) / pow(d, THROAT_EXP);
}

// Where a sheet point at norm u appears on screen (as a norm).
float project(float u) {
  return u * CAMERA_DIST / (CAMERA_DIST + surfaceDepth(u));
}

// Inverse of project(): the sheet point seen at screen norm uq. project() rises
// monotonically from 0 to 1, so bisection is safe.
float unproject(float uq) {
  if (uq >= 1.0 || gAmp <= 0.0) return uq;
  float lo = 0.0;
  float hi = 1.0;
  for (int i = 0; i < SOLVE_STEPS; i++) {
    float mid = 0.5 * (lo + hi);
    if (project(mid) < uq) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return 0.5 * (lo + hi);
}

float span(vec2 t) {
  return smoothstep(t.x, t.y, gProgress);
}

// Accelerating into the landing (a falling ball: no easing out).
float fallSpan(vec2 t) {
  float x = clamp((gProgress - t.x) / (t.y - t.x), 0.0, 1.0);
  return x * x;
}

// After landing: how far below "at rest" the bounce is, at time s since the landing in
// units of the fall's duration (the fall covers 1 in time 1, so gravity = 2).
float bounceDip(float s) {
  float start = 0.0;
  float e     = 1.0;
  for (int i = 0; i < BOUNCE_COUNT; i++) {
    e *= uBounce;              // launch speed relative to the impact speed
    float dur = 2.0 * e;        // time in the air
    if (s < start + dur) {
      float x = (s - start) / dur;
      return e * e * 4.0 * x * (1.0 - x);  // parabola peaking at e^2
    }
    start += dur;
  }
  return 0.0;
}

// Total time of the bounces, in units of the fall's duration.
float bounceTime() {
  float total = 0.0;
  float e     = 1.0;
  for (int i = 0; i < BOUNCE_COUNT; i++) {
    e     *= uBounce;
    total += 2.0 * e;
  }
  return total;
}

// The sheet point seen at layer pixel px (portal space v, screen norm uq), in layer
// pixels, and how bright the sheet is there: fog with depth (this is what makes the
// void), plus light on the slopes.
void sheetAt(vec2 px, vec2 v, float uq, out vec2 sheetPx, out float bright) {
  if (uq >= 1.0 || gAmp <= 0.0) {
    sheetPx = px;
    bright  = 1.0;
    return;
  }
  float u = unproject(uq);
  sheetPx = uCenter + v * (u / max(uq, 1e-6)) * gAxes;

  float h     = surfaceDepth(u);
  float slope = (surfaceDepth(u + 1e-3) - h) / -1e-3;
  slope       = max(slope, 0.0) / (1.0 + max(slope, 0.0));
  vec2  dir   = uq > 1e-5 ? normalize(v) : vec2(0.0);
  bright      = max(exp(-h * gFog) * (1.0 + WALL_LIGHT * dot(dir, LIGHT_TO) * slope), 0.0);
}

void main() {
  gProgress = uForOpening ? uProgress : 1.0 - uProgress;
  gFog      = FOG_BASE / max(uTunnelDepth, 0.05);

  // Bounce: the main timeline runs in the first `mainPart` of the animation (uProgress
  // is elapsed time both ways), the bounces in the rest. Opening lands the sheet's
  // flattening and the window's rise together (both end at T_FLAT.y); closing lands the
  // funnel's collapse (T_SINK, run backwards).
  bool  bounceOn    = uBounce > 0.001;
  bool  openBounce  = bounceOn && BOUNCE && uForOpening;
  bool  closeBounce = bounceOn && BOUNCE_ON_CLOSE && !uForOpening;
  float dip         = 0.0;
  bool  landed      = false;
  float landAt      = 1.0;  // elapsed time (uProgress) of the landing
  if ((openBounce || closeBounce) && BOUNCE_KEEP_INTRO) {
    // Normal pace until the landing phase starts at `knee`; then the fall runs (1 + bounce
    // time) times faster, so fall + bounces exactly fill the rest of the animation.
    float knee    = openBounce ? T_FLAT.x : 1.0 - T_SINK.y;
    float speed   = 1.0 + bounceTime();
    float fallDur = (1.0 - knee) / speed;
    landAt        = knee + fallDur;
    float p       = uProgress <= knee ? uProgress : min(knee + (uProgress - knee) * speed, 1.0);
    gProgress     = uForOpening ? p : 1.0 - p;
    if (uProgress > landAt) {
      landed = true;
      dip    = bounceDip((uProgress - landAt) / fallDur);
    }
  } else if (openBounce || closeBounce) {
    vec2  fall     = openBounce ? T_FLAT : T_SINK;
    float fallTime = fall.y - fall.x;
    float mainPart = 1.0 / (1.0 + bounceTime() * fallTime);
    float p        = min(uProgress / mainPart, 1.0);
    gProgress      = uForOpening ? p : 1.0 - p;
    landAt         = mainPart;
    if (uProgress > mainPart) {
      landed = true;
      dip    = bounceDip((uProgress - mainPart) / (mainPart * fallTime));
    }
  }

  float sink  = span(T_SINK);
  if (closeBounce) {
    // Collapsing: accelerating to flat (no easing out), then the dips.
    float x = clamp((T_SINK.y - gProgress) / (T_SINK.y - T_SINK.x), 0.0, 1.0);
    sink    = 1.0 - x * x + dip;
  }
  float widen = span(T_WIDEN);
  float flatT = openBounce ? fallSpan(T_FLAT) - dip : span(T_FLAT);
  if (closeBounce && landed) {
    // Closing dips use the same dimple as the opening ones (the full funnel, flattening
    // by `dip`). The sheet is flat at the landing either way, so the switch is seamless.
    sink  = 1.0;
    widen = 1.0;
    flatT = 1.0 - dip;
  }
  float riseT = openBounce ? fallSpan(vec2(T_RISE.x, T_FLAT.y)) - dip * BOUNCE_WINDOW : span(T_RISE);
  if (openBounce && BOUNCE_KEEP_INTRO) {
    // The window's rise starts (T_RISE.x) before the knee; fall it in real time to the
    // landing so its speed has no kink where the timeline speeds up.
    float x = clamp((uProgress - T_RISE.x) / (landAt - T_RISE.x), 0.0, 1.0);
    riseT   = x * x - dip * BOUNCE_WINDOW;
  }
  float flatness = 1.0 - flatT;
  // The floor rises as the sheet flattens. When the close bounces, it also rises as the
  // funnel collapses, so the void closes from below and each dip is a shallow dimple.
  float floorT = closeBounce ? max(flatT, 1.0 - sink) : flatT;
  gFloor       = FLOOR_START + FLOOR_RISE * floorT * floorT;
  gAmp        = AMPLITUDE * sink * mix(AMP_START, 1.0, widen) * flatness;
  gThroat     = uVoidSize * sink * mix(THROAT_START, 1.0, widen) * flatness;
  gAxes       = uAxes * mix(SPREAD_START, 1.0, widen);

  // The window's on-screen size grows geometrically (an even rate of growth to the eye),
  // eased in and out: from WIN_START_SIZE to exactly 1.
  gWinSize  = exp(log(WIN_START_SIZE) * (1.0 - riseT));
  gWinAlpha = span(T_APPEAR);
  gSheetScale = exp(log(WIN_SHEET_START) * (1.0 - riseT));

  // Its depth follows from its size: it sits where the tube (as seen on screen) is just
  // wide enough to hold it, so the sheet never cuts it. As the window grows and the sheet
  // flattens, that spot moves up: the window is pushed out. The depth only drives its fog.
  float extent = shapeNorm(uFrameHalf / gAxes) * gWinSize / TUBE_FIT;  // screen norm needed
  gWinDepth    = extent >= 1.0 ? 0.0 : surfaceDepth(unproject(extent));

  vec2  px = getLayerPx();  // pixel position in the layer
  vec2  v  = (px - uCenter) / gAxes;                     // portal space
  float uq = shapeNorm(v);                               // screen norm of this fragment

  vec4 oColor;

  if (uLayer < 0.5) {
    // ---------------------------------------------------------------- surface layer
    if (uq >= 1.0 || gAmp <= 0.0) {
      // Outside the funnel, or at rest: exactly what's on screen.
      oColor = getInputColor(iTexCoord.st);
    } else {
      // The sheet point seen here. Sampled as an offset from this fragment's own texture
      // coordinate, so the result is exact wherever the offset is zero.
      vec2  sheetPx;
      float bright;
      sheetAt(px, v, uq, sheetPx, bright);
      oColor      = getInputColor(iTexCoord.st + (sheetPx - px) / uTexRect.zw);
      oColor.rgb *= bright;
      oColor.a    = 1.0;  // the void is opaque
    }
  } else {
    // ----------------------------------------------------------------- window layer
    if (WINDOW_ON_SHEET) {
      if (gAmp <= 0.0 && gSheetScale >= 0.9999 && gWinAlpha >= 1.0) {
        oColor = getInputColor(iTexCoord.st);  // at rest
      } else {
        // The window lies on the sheet, scaled around the centre: find the sheet point
        // seen here, then the window pixel at that point. Same shading as the sheet.
        vec2  sheetPx;
        float bright;
        sheetAt(px, v, uq, sheetPx, bright);
        vec2 srcPx = uCenter + (sheetPx - uCenter) / max(gSheetScale, 1e-4);
        vec2 tc    = iTexCoord.st + (srcPx - px) / uTexRect.zw;
        oColor     = vec4(0.0);
        if (all(greaterThanEqual(tc, vec2(0.0))) && all(lessThanEqual(tc, vec2(1.0)))) {
          oColor = getInputColor(tc);
        }
        oColor.rgb *= bright;
        oColor.a   *= gWinAlpha;
      }
      setOutputColor(oColor);
      return;
    }

    // Floating in the tube: on-screen scale of the window (see gWinSize).
    float P = gWinSize;

    if (P >= 0.9999 && gWinAlpha >= 1.0) {
      oColor = getInputColor(iTexCoord.st);  // at rest
    } else {
      vec2 srcPx = uCenter + (px - uCenter) / max(P, 1e-4);
      vec2 tc    = iTexCoord.st + (srcPx - px) / uTexRect.zw;
      oColor     = vec4(0.0);
      if (all(greaterThanEqual(tc, vec2(0.0))) && all(lessThanEqual(tc, vec2(1.0)))) {
        oColor = getInputColor(tc);
      }
      // Same fog as the sheet at its depth: it comes up out of the dark.
      oColor.rgb *= exp(-gWinDepth * gFog * WIN_FOG_SCALE);
      oColor.a   *= gWinAlpha;
    }
  }

  setOutputColor(oColor);
}
