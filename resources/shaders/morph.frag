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
// Morph (see effects/Morph.js).                                                        //
//                                                                                      //
// The area where the window will appear morphs into the window. A classic morph is     //
// "warp both images with the same flow field, and cross-dissolve". We can't match      //
// features between the two images (each shader only sees its own layer), so the flow   //
// field is procedural: a curl-noise field (swirly, liquid, no sources or sinks) plus   //
// a gentle radial push away from the window's centre.                                  //
//                                                                                      //
// Two layers, same uniforms, bottom to top:                                            //
//   uLayer = 0  "surface": wallpaper + desktop + windows behind (opaque)               //
//   uLayer = 1  "window":  a clone of the window (with its shadow)                      //
// Drawing the window at alpha a over the opaque surface IS the cross-dissolve.         //
//                                                                                      //
// The surface flows forward along the field (0 -> full) while the window arrives from  //
// the opposite direction (full -> 0), so each is exact at its own rest frame. Both get //
// a little blur while they're displaced, which hides the fact that nothing lines up.   //
// The dissolve is uneven (a low-frequency noise threshold), so the window condenses    //
// out of the surface in blotches rather than fading in uniformly.                      //
//////////////////////////////////////////////////////////////////////////////////////////

// uLayer, uLayerSize and uTexRect, and getLayerPx(), are in common.glsl.
uniform vec4  uFrameRect;  // the visible window (frame rect), in layer pixels: x, y, width, height
uniform vec2  uSeed;       // random per animation, identical on both layers
uniform float uStyle;      // morph-style: 0 = liquid flow, 1 = melt (edge-guided), 2 = pixelate
uniform float uStrength;   // morph-strength: multiplies FLOW_PX, RADIAL_PX, MELT_PX and PIXEL_PX (1 = as tuned)

// ---- Tunables ----

const float FLOW_PX      = 30.0;   // how far the liquid flow displaces pixels at its peak
const float FLOW_SCALE   = 160.0;  // size of the swirls in px (bigger = broader, calmer flow)
const float RADIAL_PX    = 30.0;   // extra push away from the window's centre (0 = none)
const float SPILL_PX     = 5.0;   // the morph reaches this far outside the window, feathered
const float CORNER_PX    = 24.0;   // rounding of the morph region's corners
const float BLUR_PX      = 6.0;    // blur radius at the peak of the displacement (0 = none)

const float DISSOLVE_SCALE = 380.0; // size of the dissolve blotches in px
const float DISSOLVE_EDGE  = 0.22;  // softness of the dissolve front (0..0.5; 0.5 = plain fade)

// Edge-guided melt. Instead of one shared swirl, each layer is pushed around by the
// edges in its OWN image (the luminance gradient): content slides along its contours
// and bleeds across them, so the surface's features melt away along their outlines and
// the window's features form along theirs. The window's strongest edges also appear
// first in the dissolve (outlines, then fills). Chosen with the morph-style setting.
const float MELT_PX      = 40.0;   // how far pixels travel along / across edges at the peak
const float MELT_RADIUS  = 8.0;    // px: scale at which edges are measured (bigger = broader, smoother)
const float MELT_ALONG   = 0.7;    // share of the motion along the contours (swirls around shapes)
const float MELT_ACROSS  = 0.5;    // share across the contours (edges bleed / smear)
const float MELT_NOISE   = 0.35;   // share of the liquid flow (FLOW_PX), so flat areas move too
const int   MELT_STEPS   = 3;      // advection steps (more = smoother, curvier trails, slower)
const float EDGE_FIRST   = 0.35;   // how much earlier the window's strong edges appear (0 = off)

// Pixelate. Both layers coarsen into the same grid of blocks (anchored at the window's
// centre), the window's blocks dissolve in one by one over the surface's, so each block
// changes from the colour of what's behind into the colour of the window, and then both
// sharpen back to full resolution. The surface sharpens too, so the window's transparent
// parts (rounded corners, shadow) are exact at the end. Closing runs it backwards.
const float PIXEL_PX     = 24.0;   // block size at the peak, in px
const int   PIXEL_TAPS   = 3;      // taps per side averaged for each block's colour (1 = centre only)
const float PIXEL_RANDOM = 0.75;   // share of each block's start time that is random (the rest
                                   // follows the blotchy DISSOLVE_SCALE noise)
const float PIXEL_SPREAD = 1.3;    // stretches the start times towards an even spread (the
                                   // noise/random mix bunches up in the middle otherwise)
const float PIXEL_DUR    = 0.5;    // how long each block's colour change takes, as a share of the
                                   // P_FADE span (1 = all blocks change together, a plain crossfade)
// The pixelate and sharpen phases each take PIXEL_RESIZE of the animation, and the colour
// change overlaps them by PIXEL_OVERLAP (0 = strictly one after another, 1 = the colour
// change runs the whole animation, alongside both). Overlap avoids idle stretches
// (pixelating a smooth wallpaper on its own shows almost nothing) and blends the steps.
// Start times come from the peak-size grid, so they stay put while the size changes.
const float PIXEL_RESIZE  = 0.5;
const float PIXEL_OVERLAP = 1.0;
const vec2  P_COARSEN = vec2(0.0, PIXEL_RESIZE);                   // 1 px -> peak block size
const vec2  P_FADE    = vec2(PIXEL_RESIZE * (1.0 - PIXEL_OVERLAP),   // surface -> window colour
                             1.0 - PIXEL_RESIZE * (1.0 - PIXEL_OVERLAP));
const vec2  P_SHARPEN = vec2(1.0 - PIXEL_RESIZE, 1.0);             // peak block size -> 1 px

// Timeline (fractions of the opening progress, 0 -> 1).
const vec2 T_SURFACE = vec2(0.00, 0.60);  // the surface's displacement grows over this span
const vec2 T_WINDOW  = vec2(0.40, 1.00);  // the window's displacement shrinks to 0 over this span
const vec2 T_FADE    = vec2(0.20, 0.85);  // the dissolve from surface to window

// ---- Per-frame state ----

float gProgress;
bool  MELT;        // uStyle == melt
float gBlur;       // blur radius at the peak (BLUR_PX scaled by the strength)

float span(vec2 t) {
  return smoothstep(t.x, t.y, gProgress);
}

// Signed distance to the frame rect, rounded by CORNER_PX (> 0 outside).
float frameDist(vec2 px) {
  vec2 c = uFrameRect.xy + 0.5 * uFrameRect.zw;
  vec2 h = max(0.5 * uFrameRect.zw - CORNER_PX, vec2(0.0));
  vec2 q = abs(px - c) - h;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - CORNER_PX;
}

// 1 inside the window, fading to 0 SPILL_PX outside it.
float regionMask(vec2 px) {
  return 1.0 - smoothstep(0.0, SPILL_PX, frameDist(px));
}

// Stream function for the curl noise: two octaves of simplex noise.
float streamFn(vec2 p) {
  return simplex2D(p) + 0.5 * simplex2D(p * 2.03 + vec2(17.1, 5.3));
}

// The full flow field at layer pixel px, in pixels (before the timeline scales it).
vec2 flowAt(vec2 px) {
  float m = regionMask(px);
  if (m <= 0.0) return vec2(0.0);

  vec2  p   = px / FLOW_SCALE + uSeed * 100.0;
  const float E = 0.01;
  float dx  = (streamFn(p + vec2(E, 0.0)) - streamFn(p - vec2(E, 0.0))) / (2.0 * E);
  float dy  = (streamFn(p + vec2(0.0, E)) - streamFn(p - vec2(0.0, E))) / (2.0 * E);
  vec2  c   = vec2(dy, -dx);
  c /= 2.3 + 0.3 * length(c);  // ~unit length, soft-limited (calibrated for streamFn)

  // Push away from the centre, strongest halfway out.
  vec2  centre = uFrameRect.xy + 0.5 * uFrameRect.zw;
  vec2  rel    = (px - centre) / max(0.5 * uFrameRect.zw, vec2(1.0));
  float r      = length(rel);
  vec2  radial = r > 1e-4 ? rel / r * sin(3.14159 * min(r, 1.0)) : vec2(0.0);

  return m * uStrength * (c * FLOW_PX + radial * RADIAL_PX);
}

// Straight-alpha texture read at texture coord tc. The window has nothing outside its
// texture; the surface is clamped (it's opaque and its edges don't move).
vec4 readLayer(vec2 tc) {
  if (uLayer < 0.5) {
    return getInputColor(clamp(tc, vec2(0.0), vec2(1.0)));
  }
  if (any(lessThan(tc, vec2(0.0))) || any(greaterThan(tc, vec2(1.0)))) {
    return vec4(0.0);
  }
  return getInputColor(tc);
}

// A small disc blur of radius r px around tc, averaged with premultiplied alpha.
vec4 blurredRead(vec2 tc, float r) {
  if (r < 0.5) return readLayer(tc);
  vec4  acc = vec4(0.0);
  float n   = 0.0;
  for (int i = 0; i < 13; i++) {
    vec2 o;
    if (i == 0) {
      o = vec2(0.0);
    } else {
      float k   = float(i - 1);
      float ang = k * 0.5235988 + (k < 6.0 ? 0.0 : 0.2617994);  // two rings of 6, offset
      float rad = k < 6.0 ? 0.5 * r : r;
      o = vec2(cos(ang), sin(ang)) * rad;
    }
    vec4 s = readLayer(tc + o / uTexRect.zw);
    acc += vec4(s.rgb * s.a, s.a);
    n += 1.0;
  }
  acc /= n;
  return acc.a > 0.0 ? vec4(acc.rgb / acc.a, acc.a) : vec4(0.0);
}

float gEdge = 0.0;  // edge strength (0..1) at the fragment's own spot, from the first melt step

float luma(vec4 c) {
  // Transparent counts as mid-grey, so the window's outline is an edge too.
  return c.a * dot(c.rgb, vec3(0.299, 0.587, 0.114)) + (1.0 - c.a) * 0.5;
}

// Melt direction at texture coord tc, from this layer's own image: a unit-ish vector
// mixing "along the contour" and "across it", scaled by how strong the edge is.
vec2 meltDir(vec2 tc) {
  vec2 g = vec2(0.0);
  for (int k = 0; k < 8; k++) {
    float ang = float(k) * 0.7853982;
    vec2  dir = vec2(cos(ang), sin(ang));
    g += luma(readLayer(tc + dir * MELT_RADIUS / uTexRect.zw)) * dir;
  }
  g *= 0.25;                     // ~ luminance difference across the ring
  float len = length(g);
  if (len < 1e-4) return vec2(0.0);
  float strength = smoothstep(0.02, 0.25, len);
  if (gEdge < 0.0) gEdge = strength;
  vec2  n = g / len;
  return strength * (MELT_ALONG * vec2(-n.y, n.x) + MELT_ACROSS * n);
}

// Moves texture coord tc through the melt field, amt = signed share of the full motion.
vec2 meltAdvect(vec2 tc, float amt, vec2 px, vec2 flow) {
  float m = regionMask(px);
  gEdge = -1.0;
  for (int i = 0; i < MELT_STEPS; i++) {
    vec2 d = m * meltDir(tc) * MELT_PX * uStrength + flow * MELT_NOISE;  // flow is already scaled
    tc += d * amt / float(MELT_STEPS) / uTexRect.zw;
  }
  if (gEdge < 0.0) gEdge = 0.0;
  return tc;
}

// ------------------------------------------------------------------- pixelate style

// The average (premultiplied, then straightened) colour of the block centred at c.
vec4 blockColor(vec2 c, float bs) {
  vec4 acc = vec4(0.0);
  for (int j = 0; j < PIXEL_TAPS; j++) {
    for (int i = 0; i < PIXEL_TAPS; i++) {
      vec2 p = c + ((vec2(float(i), float(j)) + 0.5) / float(PIXEL_TAPS) - 0.5) * bs;
      vec4 t = readLayer((p - uTexRect.xy) / uTexRect.zw);
      acc += vec4(t.rgb * t.a, t.a);
    }
  }
  acc /= float(PIXEL_TAPS * PIXEL_TAPS);
  return acc.a > 0.0 ? vec4(acc.rgb / acc.a, acc.a) : vec4(0.0);
}

vec4 pixelateMain(vec2 px) {
  // Block size: identical on both layers at every moment, so their grids line up.
  float coarse = span(P_COARSEN) * (1.0 - span(P_SHARPEN));
  float bs     = floor(mix(1.0, max(PIXEL_PX * uStrength, 1.0), coarse) + 0.5);

  vec2 centre = uFrameRect.xy + 0.5 * uFrameRect.zw;
  vec2 cell   = floor((px - centre) / bs);
  vec2 lo     = centre + cell * bs;         // this block's corner, in layer px
  vec2 blockC = lo + 0.5 * bs;

  // Pixelate every block that touches the window, so its whole frame goes blocky.
  bool inRegion = all(lessThan(lo, uFrameRect.xy + uFrameRect.zw)) &&
                  all(greaterThan(lo + bs, uFrameRect.xy));

  vec4 oColor = (inRegion && bs > 1.0) ? blockColor(blockC, bs) : getInputColor(iTexCoord.st);

  if (uLayer < 0.5) {
    oColor.a = 1.0;  // opaque, so window-over-surface is a true per-block dissolve
  } else {
    float f = span(P_FADE);
    if (f < 1.0) {
      // Each block gets its own moment: part blotchy noise, part pure random.
      // Taken from the peak-size block, so it doesn't jump while the size changes.
      float peak  = max(floor(PIXEL_PX * uStrength + 0.5), 1.0);
      vec2  pcell = floor((blockC - centre) / peak);
      vec2  pC    = centre + (pcell + 0.5) * peak;
      float n = simplex2D(pC / DISSOLVE_SCALE + uSeed * 37.0 + 3.7);
      n       = clamp((n - 0.5) * 1.6 + 0.5, 0.0, 1.0);
      n       = mix(n, hash12(pcell + floor(uSeed * 1000.0)), PIXEL_RANDOM);
      n       = clamp((n - 0.5) * PIXEL_SPREAD + 0.5, 0.0, 1.0);
      // Every block's change fits inside the fade span: starts at n * (1 - dur), lasts dur.
      float t0 = n * (1.0 - PIXEL_DUR);
      oColor.a *= smoothstep(t0, t0 + PIXEL_DUR, f);
    }
  }
  return oColor;
}

void main() {
  gProgress = uForOpening ? uProgress : 1.0 - uProgress;

  if (uStyle > 1.5) {
    setOutputColor(pixelateMain(getLayerPx()));
    return;
  }

  MELT      = uStyle > 0.5;
  gBlur     = BLUR_PX * min(uStrength, 1.0);  // no blur without motion; no more than tuned

  vec2 px   = getLayerPx();  // pixel position in the layer
  vec2 flow = flowAt(px);

  vec4 oColor;

  if (uLayer < 0.5) {
    // ---------------------------------------------------------------- surface layer
    float s = span(T_SURFACE);
    if (s <= 0.0 || flow == vec2(0.0)) {
      oColor = getInputColor(iTexCoord.st);  // exact at rest and outside the region
    } else {
      // Content moves forward along the flow, so we sample behind it. Sampled as an offset
      // from this fragment's own texture coordinate (exact where the offset is zero).
      vec2 tc = MELT ? meltAdvect(iTexCoord.st, -s, px, flow)
                     : iTexCoord.st - flow * s / uTexRect.zw;
      oColor  = blurredRead(tc, gBlur * s * regionMask(px));
    }
    oColor.a = 1.0;  // the surface is opaque, so window-over-surface is a true dissolve
  } else {
    // ----------------------------------------------------------------- window layer
    float w = 1.0 - span(T_WINDOW);
    float f = span(T_FADE);

    if (w <= 0.0 && f >= 1.0) {
      oColor = getInputColor(iTexCoord.st);  // at rest
    } else {
      // Arrives from the opposite direction: it's where the surface would have flowed
      // to, and settles into place.
      vec2 tc = MELT ? meltAdvect(iTexCoord.st, w, px, flow)
                     : iTexCoord.st + flow * w / uTexRect.zw;
      oColor  = blurredRead(tc, gBlur * w * regionMask(px));

      // Uneven dissolve: each spot has its own threshold n in [0, 1]; the fade front
      // f sweeps from below 0 to above 1, so every spot is fully in by the end.
      float n = simplex2D(px / DISSOLVE_SCALE + uSeed * 37.0 + 3.7);
      n       = clamp((n - 0.5) * 1.6 + 0.5, 0.0, 1.0);
      float early = MELT ? EDGE_FIRST : 0.0;
      n      -= early * gEdge;   // strong edges of the window come in first
      float a = smoothstep(n - DISSOLVE_EDGE, n + DISSOLVE_EDGE,
                           mix(-DISSOLVE_EDGE - early, 1.0 + DISSOLVE_EDGE, f));
      oColor.a *= a;
    }
  }

  setOutputColor(oColor);
}
