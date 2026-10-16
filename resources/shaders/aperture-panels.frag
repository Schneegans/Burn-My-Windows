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
// Aperture Panels: the window is split into a grid of panels (like the moving wall     //
// panels in the Portal games) which flip over one after another. When a window opens,  //
// each panel shows what was behind the window on its front and the window on its back; //
// when it closes, the same thing plays in reverse.                                     //
//                                                                                      //
// A shader only ever sees the texture of the actor it is attached to, so the effect    //
// (effects/AperturePanels.js) stacks three actors over the window, bottom to top:      //
//   wall  = wallpaper, desktop icons, desklets (no shader; it never moves)             //
//   front = clones of the windows behind the window    (this shader, uLayer = 0)       //
//   back  = a clone of the window, including its shadow (this shader, uLayer = 1)      //
// Both shader instances get identical uniforms every frame, so they agree on every     //
// panel.                                                                               //
//                                                                                      //
// Only the visible window (uFrame) is split into panels. Around it (the shadow margin) //
// front shows the windows behind as they are, and back shows the window's shadow       //
// fading in as the nearest edge panel turns. Inside the grid, front draws the windows  //
// behind on every panel (squashed as it turns) and back draws the window on panels     //
// that are past 90 degrees. Gaps are transparent in both, so the wall shows through,   //
// except with the "Black Void" backdrop (uBlackVoid), where front paints them black    //
// itself rather than relying on a black wall actor being drawn behind it.             //
//////////////////////////////////////////////////////////////////////////////////////////

// uLayer, uLayerSize and uTexRect, and getLayerPx(), are in common.glsl.
uniform vec4  uFrame;      // visible window inside the layer: x, y, width, height (pixels)
uniform vec2  uCell;       // panel size in pixels; divides the visible window exactly

// User settings (set by effects/AperturePanels.js, identical on both layers):
uniform float uWaveShape;    // shape of the wave's leading edge, see wavePosition()
uniform float uVerticalAxis; // 1 = panels turn around a vertical axis (squash sideways), 0 = horizontal
uniform float uBorderStyle;  // 0 = none, 1 = while flipping, 2 = ahead of the wave,
                             // 3 = behind the wave, 4 = ahead of and behind the wave
uniform vec4  uBorderColor;  // straight alpha
uniform float uBlackVoid;    // 1 = "Black Void" backdrop: front paints the gaps opaque black
uniform float uShowCake;     // 1 = Easter egg: a cake on the backdrop ("The cake is a lie!")
uniform vec2  uCakePos;      // random 0..1 per axis: where the cake sits, kept fully inside the window

// ---- Tunables (candidates for user settings) ----

const float SPREAD        = 0.6;   // part of the timeline the wave takes to cross the window
const float JITTER        = 0.0;   // 0 = clean wave; raise (e.g. 0.1) to roughen individual panels

const float WAVE_AMP      = 0.08;  // shapes 2 and 3: how far the edge bends (fraction of the sweep)
const float WAVE_FREQ     = 2.0;   // shape 2: ripples along the edge
const float WAVE_NOISE_PX = 300.0; // shape 3: size of the noise bends, in pixels

// Panel borders: depending on uBorderStyle, a wave of outlines runs ahead of the flip wave
// and/or another wave removes them behind it. LEAD / TRAIL are how far ahead / behind, as
// fractions of the animation.
const float BORDER_LEAD   = 0.25;
const float BORDER_TRAIL  = 0.15;
const float BORDER_PX     = 1.0;   // line width drawn by each panel (neighbours add up to ~2px)
const float EDGE_SHADE    = 0.4;   // brightness of a panel seen edge-on (1 = no shading)

const float PERSPECTIVE = 2.5;  // camera distance in window sizes; larger = subtler 3D

const float PI = 3.14159265;

// Easter egg ("The cake is a lie!"), when uShowCake is set: a CAKE_PX cake at a random spot
// (uCakePos) on the backdrop, peeking through the gaps between the turning panels; only on
// windows at least CAKE_MIN_SCALE times its size in each direction.
const float CAKE_PX        = 128.0;
const float CAKE_MIN_SCALE = 3.0;

// Animation progress: 0 = everything behind the window showing, 1 = the window showing.
// Opening runs 0 -> 1, closing 1 -> 0. Set at the start of main().
float gProgress;

// From the settings, also set at the start of main().
int   gWaveShape;
bool  gVertical;
bool  gBorder;       // any border at all
float gBorderLead;   // how far ahead of a panel's flip its border appears (0 = as it starts)
float gBorderTrail;  // how far behind it the border disappears (0 = as it ends)

float panelHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Where along the sweep (0..1) the panel at grid position `cell` sits. 0 flips first,
// 1 flips last. The set of panels sharing a value is the wave's leading edge. Shapes:
//   0 = straight diagonal line (top-left -> bottom-right)
//   1 = arc: circles spreading out from the top-left corner
//   2 = wavy diagonal: the diagonal line with a sine ripple along it
//   3 = organic diagonal: the diagonal line bent by smooth noise
//   4 = ripple from the centre: circles spreading out from the middle of the window
float wavePosition(vec2 cell) {
  vec2  pos  = (cell + 0.5) * uCell;             // panel centre, pixels from the window's top-left
  vec2  size = uFrame.zw;
  float diag = (pos.x + pos.y) / (size.x + size.y);

  if (gWaveShape == 1) {
    return length(pos) / length(size);
  }
  if (gWaveShape == 2) {
    float along = (pos.x - pos.y) / (size.x + size.y);  // position along the edge
    float bent  = diag + WAVE_AMP * sin(along * WAVE_FREQ * 2.0 * PI);
    return (bent + WAVE_AMP) / (1.0 + 2.0 * WAVE_AMP);
  }
  if (gWaveShape == 3) {
    float bent = diag + WAVE_AMP * (simplex2D(pos / WAVE_NOISE_PX + vec2(17.3, 5.9)) * 2.0 - 1.0);
    return (bent + WAVE_AMP) / (1.0 + 2.0 * WAVE_AMP);
  }
  if (gWaveShape == 4) {
    return length(pos - size * 0.5) / length(size * 0.5);
  }
  return diag;
}

// When the panel at `cell` flips, as a range of gProgress: x = start, y = end. All flips
// are squeezed into [gBorderLead, 1 - gBorderTrail], so each panel's border can appear
// before it flips and disappear after it, and there are no borders at 0 or 1.
vec2 cellTiming(vec2 cell) {
  float wave  = clamp(mix(wavePosition(cell), panelHash(cell), JITTER), 0.0, 1.0);
  float span  = 1.0 - gBorderLead - gBorderTrail;
  float start = gBorderLead + wave * SPREAD * span;
  return vec2(start, start + (1.0 - SPREAD) * span);
}

// Flip progress (0..1) of the panel at grid position `cell`.
float cellProgress(vec2 cell) {
  vec2 t = cellTiming(cell);
  return clamp((gProgress - t.x) / (t.y - t.x), 0.0, 1.0);
}

// How strongly (0..1) the panel at `cell` shows its border right now.
float cellBorder(vec2 cell) {
  vec2  t       = cellTiming(cell);
  float fadeIn  = smoothstep(t.x - max(gBorderLead, 0.001), t.x, gProgress);
  float fadeOut = smoothstep(t.y, t.y + max(gBorderTrail, 0.001), gProgress);
  return gBorder ? fadeIn * (1.0 - fadeOut) : 0.0;
}

// Signed distance from p to a rounded rectangle centred on the origin, with half-size b
// and corner radius r: negative inside, zero on the edge and positive outside. The cake
// is built entirely from these and from circles.
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

// The cake, in straight alpha. p: centred on the cake, y up, the cake fits in [-0.8, 0.8].
// aa: the size of one pixel in those units. t: time in seconds (for the candle flame).
vec4 drawCake(vec2 p, float aa, float t) {
  vec3  col = vec3(0.0);
  float a   = 0.0;

  // Paints one shape over what was painted before. d is the shape's signed distance; the
  // smoothstep turns it into a coverage that fades over about one pixel at the edge, so
  // the shapes are anti-aliased. The cake is painted back to front: plate first, flame
  // last.
  #define CAKE_LAYER(d, c) { float m = smoothstep(aa, -aa, d); col = mix(col, c, m); a = max(a, m); }

  vec3 sponge  = vec3(0.26, 0.13, 0.07);
  vec3 filling = vec3(0.45, 0.26, 0.15);  // chocolate mousse
  vec3 icing   = vec3(0.17, 0.08, 0.04);  // dark chocolate glaze
  vec3 cream   = vec3(0.98, 0.95, 0.90);  // whipped cream under the cherries
  CAKE_LAYER(sdRoundBox(p - vec2(0.0, -0.58), vec2(0.78, 0.04), 0.04), vec3(0.78, 0.80, 0.82)); // plate
  CAKE_LAYER(sdRoundBox(p - vec2(0.0, -0.26), vec2(0.56, 0.29), 0.06), sponge);                  // sponge
  CAKE_LAYER(sdRoundBox(p - vec2(0.0, -0.26), vec2(0.56, 0.03), 0.02), filling);                // filling
  CAKE_LAYER(sdRoundBox(p - vec2(0.0,  0.06), vec2(0.58, 0.07), 0.07), icing);                  // glaze
  // Glaze drips running down the sponge, each with a pseudo-random length (the usual
  // sin-hash), so the cake always looks the same.
  for (int i = 0; i < 6; i++) {                                                                  // drips
    float x   = -0.45 + float(i) * 0.18;
    float len = 0.04 + 0.05 * fract(sin(float(i) * 12.9898) * 43758.5453);
    CAKE_LAYER(sdRoundBox(p - vec2(x, -0.02 - len * 0.5), vec2(0.035, len), 0.035), icing);
  }
  CAKE_LAYER(sdRoundBox(p - vec2(-0.12, 0.10), vec2(0.30, 0.012), 0.012), vec3(0.42, 0.25, 0.15)); // glaze shine
  // Two pairs of cherries, each on a dollop of cream, leaving room for the candle between.
  for (int i = 0; i < 4; i++) {                                                                  // cherries
    float x = (i < 2) ? -0.42 + float(i) * 0.2 : 0.22 + float(i - 2) * 0.2;
    CAKE_LAYER(length(p - vec2(x, 0.15)) - 0.06, cream);
    CAKE_LAYER(length(p - vec2(x, 0.21)) - 0.055, vec3(0.70, 0.05, 0.08));
  }
  // A candle with diagonal red and white stripes and a flickering flame on top. The flame
  // is a circle, stretched upwards above its centre, which wobbles from side to side.
  vec3 stripe = mix(vec3(1.0), vec3(0.85, 0.15, 0.2), step(0.5, fract((p.y + p.x) * 14.0)));
  CAKE_LAYER(sdRoundBox(p - vec2(0.0, 0.30), vec2(0.03, 0.17), 0.01), stripe);                  // candle
  vec2  fp    = p - vec2(0.01 * sin(t * 31.0), 0.56);                                            // flame
  float flame = length(fp * vec2(1.0, 0.55 + 0.15 * step(0.0, fp.y))) - 0.045;
  CAKE_LAYER(flame, mix(vec3(1.0, 0.55, 0.1), vec3(1.0, 0.95, 0.6), smoothstep(0.0, -0.04, flame)));

  #undef CAKE_LAYER
  return vec4(col, a);
}

void main() {
  gProgress = uForOpening ? uProgress : 1.0 - uProgress;

  gWaveShape   = int(uWaveShape + 0.5);
  gVertical    = uVerticalAxis > 0.5;
  int style    = int(uBorderStyle + 0.5);
  gBorder      = style > 0 && uBorderColor.a > 0.0;
  gBorderLead  = (style == 2 || style == 4) ? BORDER_LEAD  : 0.0;
  gBorderTrail = (style == 3 || style == 4) ? BORDER_TRAIL : 0.0;

  vec4 oColor = vec4(0.0);
  bool back   = uLayer > 0.5;
  vec2 px     = getLayerPx();  // pixel position in the layer
  vec2 q      = px - uFrame.xy;                            // relative to the visible window

  if (any(lessThan(q, vec2(0.0))) || any(greaterThanEqual(q, uFrame.zw))) {
    // ---- Shadow margin: outside the visible window, no panels ----
    // Read the texture at this fragment's own coordinate, so the margin (and the texture's
    // padding beyond the layer) is exact even if uTexRect is off by a pixel.
    oColor = getInputColor(iTexCoord.st);
    if (back) {
      // The window's shadow fades in once the nearest edge panel has turned.
      vec2  nearest = floor(clamp(q, vec2(0.0), uFrame.zw - 0.001) / uCell);
      float reveal  = clamp(cellProgress(nearest) * 2.0 - 1.0, 0.0, 1.0);
      oColor.a *= reveal;
    }
  } else {
    // ---- Panels over the visible window ----
    vec2  cell   = floor(q / uCell);
    vec2  cellUV = (q - cell * uCell) / uCell;
    float local  = cellProgress(cell);
    float squash = abs(cos(local * PI));

    // Rotate the panel around its centre axis and project it with the vanishing point in
    // the middle of the window. We invert the projection: from the screen position, find
    // the position on the panel itself (panelUV). a = across the rotation axis, b = along
    // it.
    float theta = local * PI;
    float cT    = cos(theta);
    float sT    = sin(theta);
    float dist  = PERSPECTIVE * max(uFrame.z, uFrame.w);  // camera distance

    vec2 centre =
      (cell + 0.5) * uCell - uFrame.zw * 0.5;       // panel centre from window centre
    vec2 screen = centre + (cellUV - 0.5) * uCell;  // fragment from window centre
    if (!gVertical) {
      centre = centre.yx;
      screen = screen.yx;
    }

    bool onPanel = false;
    vec2 panelUV = cellUV;
    float den    = dist * cT + screen.x * sT;
    if (abs(den) > 0.001) {
      float u = dist * (screen.x - centre.x) / den;
      float s = dist / (dist - u * sT);
      float v = screen.y / s - centre.y;
      if (local > 0.5) u = -u;  // the back face is not mirrored
      vec2 m  = gVertical ? vec2(u, v) : vec2(v, u);
      panelUV = m / uCell + 0.5;

      // The inverse projection loses a little precision (the panel centre is subtracted
      // again), so a pixel on a shared edge can land just outside [0, 1] and leave a gap.
      const float EPS = 0.002;
      onPanel = dist - u * sT > 0.0 && all(greaterThanEqual(panelUV, vec2(-EPS))) &&
                all(lessThanEqual(panelUV, vec2(1.0 + EPS)));
      panelUV = clamp(panelUV, 0.0, 1.0);
    }

    // front: the windows behind, on every panel. Under a turned panel they only show
    // through the window's transparent bits (rounded corners), which keeps the final frame
    // exact. back: the window, only once the panel is past 90 degrees.
    if (onPanel && (!back || local > 0.5)) {
      vec2 src   = uFrame.xy + (cell + panelUV) * uCell;
      vec4 panel = getLayerColor(src);

      // Shade the panel as it turns edge-on (none at local = 0 and 1).
      panel.rgb *= mix(EDGE_SHADE, 1.0, squash);

      // Border (see uBorderStyle, cellBorder()). Drawn by whichever layer
      // shows this panel's current face, on top of that face (and on its own where the face
      // is bare, so the outline also shows over the wall).
      bool  showingFace = back ? local > 0.5 : local <= 0.5;
      float amount      = cellBorder(cell);
      if (showingFace && amount > 0.0) {
        vec2  rimScale = gVertical ? vec2(uCell.x * squash, uCell.y)
                                   : vec2(uCell.x, uCell.y * squash);
        vec2  edge     = min(panelUV, 1.0 - panelUV) * rimScale;
        float line     = 1.0 - smoothstep(BORDER_PX - 0.5, BORDER_PX + 0.5, min(edge.x, edge.y));
        vec4  border   = uBorderColor;
        border.a      *= line * amount;
        panel = alphaOver(panel, border);
      }

      oColor = panel;
    } else if (!back) {
      // A gap between turning panels: the black void (the wallpaper is on the panels), or
      // transparent so the wall shows through.
      if (uBlackVoid > 0.5) {
        oColor = vec4(0.0, 0.0, 0.0, 1.0);
      }

      // Easter egg: the cake sits on the backdrop, so it only peeks through the gaps.
      if (uShowCake > 0.5 && all(greaterThanEqual(uFrame.zw, vec2(CAKE_PX * CAKE_MIN_SCALE)))) {
        // uCakePos picks the cake's centre so that the whole cake stays inside the window.
        // q is converted to the cake's own units (see drawCake()), with y pointing up.
        vec2 centre = CAKE_PX * 0.5 + uCakePos * (uFrame.zw - CAKE_PX);
        vec2 c      = (q - centre) / (CAKE_PX * 0.5) * 0.8;  // cake units, see drawCake()
        c.y    = -c.y;
        // Only pixels near the cake are drawn, which keeps the cost low elsewhere.
        if (all(lessThanEqual(abs(c), vec2(0.82)))) {
          oColor = alphaOver(oColor, drawCake(c, 0.8 / (CAKE_PX * 0.5), uProgress * uDuration));
        }
      }
    }
  }

  setOutputColor(oColor);
}
