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

// The content from common.glsl is automatically prepended to each shader effect.

uniform vec3 uColor;

const float PORTAL_OPEN_TIME      = 0.3;
const float PORTAL_CLOSE_TIME     = 0.4;
const float PORTAL_ROTATION_SPEED = 0.5;
const float PORTAL_WARPING        = 2.0;

const float WINDOW_ANIMATION_TIME = 0.4;
const float WINDOW_SCALE          = 0.3;
const float WINDOW_SQUISH         = 1.0;
const float WINDOW_TILT           = -1.0;
const float WINDOW_SHIFT          = 0.0;

const float GLOW_EDGE_WIDTH = 0.02;

vec4 getPortalColor() {

  // We simply inverse the progress for opening windows.
  float progress = uForOpening ? 1.0 - uProgress : uProgress;

  // Put coordinate origin to the center of the window and make ensure a 1:1 aspect ratio.
  vec2 coords = (iTexCoord.st - vec2(0.5)) * 2.0 * uSize / vec2(min(uSize.x, uSize.y));

  // Add some margin for the elastic overshooting.
  coords *= 1.5;

  float scale = 1.0;
  if (uProgress < PORTAL_OPEN_TIME) {
    scale = easeOutBack(uProgress / PORTAL_OPEN_TIME);
  } else if (uProgress > 1.0 - PORTAL_CLOSE_TIME) {
    scale = easeOutBack(1.0 - (uProgress - 1.0 + PORTAL_CLOSE_TIME) / PORTAL_CLOSE_TIME);
  }

  coords /= max(scale, 0.01);

  // Apply some whirling.
  // The math for the whirling is inspired by this post:
  float rotation = PORTAL_ROTATION_SPEED * uProgress;
  float warping  = PORTAL_WARPING * (1.0 + 0.5 * uProgress);
  coords         = whirl(coords, warping, rotation);

  float xDisplace = simplex2D(coords * 2.0) - 0.5;
  float yDisplace = simplex2D(coords * 2.0 + vec2(12.0, 123.0)) - 0.5;
  coords += vec2(xDisplace, yDisplace) * 0.1;

  float dist           = length(coords);
  vec3 backgroundColor = mix(0.2 * uColor, 0.8 * uColor, clamp(pow(dist, 5.0), 0.0, 1.0));
  float alpha          = dist > 1.0 ? 0.0 : 1.0;
  vec4 color           = vec4(backgroundColor, alpha);

  float glowingEdge =
    pow(clamp((1.0 - abs(dist - 1.0)) + GLOW_EDGE_WIDTH, 0.0, 1.0), 100.0);
  color = alphaOver(color, vec4(vec3(1.0), glowingEdge));

  float bands = simplex2D(coords * 4.0) > 0.7 ? alpha : 0.0;
  color       = alphaOver(color, vec4(uColor, bands));

  float stars = pow((simplex3D(vec3(coords * 5.0, uProgress * uDuration))) + 0.2, 50.0);
  color.rgb += vec3(stars);

  color.a *= pow(clamp(scale, 0.0, 1.0), 2.0);

  return clamp(color, 0.0, 1.0);
}

vec4 getWindowColor() {
  float progress = (uForOpening ? (1.0 - uProgress) : uProgress) / WINDOW_ANIMATION_TIME;

  progress = easeInBack(clamp(progress, 0.0, 1.0));

  // Put texture coordinate origin to center of window.
  vec2 coords = iTexCoord.st * 2.0 - 1.0;

  // Scale image texture with progress.
  coords /= mix(1.0, WINDOW_SCALE, progress);

  // Squish image texture vertically.
  coords.y /= mix(1.0, (1.0 - 0.2 * WINDOW_SQUISH), progress);

  // 'Tilt' image texture around x-axis.
  coords.x /= mix(1.0, 1.0 - 0.1 * WINDOW_TILT * coords.y, progress);

  // Move image texture vertically.
  coords.y += WINDOW_SHIFT * progress;

  // Move texture coordinate center to corner again.
  coords = coords * 0.5 + 0.5;

  vec4 oColor = getInputColor(coords);

  // Dissolve window.
  oColor.a *= clamp((1.0 - progress) * 3.0, 0.0, 1.0);

  return oColor;
}

void main() {
  vec4 portal = getPortalColor();
  vec4 window = getWindowColor();

  setOutputColor(alphaOver(portal, window));

  // setOutputColor(portal);
  // setOutputColor(window);
}