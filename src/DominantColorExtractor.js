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

//////////////////////////////////////////////////////////////////////////////////////////
// https://github.com/home-sweet-gnome/dash-to-panel/blob/master/utils.js#L669
// DominantColorExtractor is adapted from https://github.com/micheleg/dash-to-dock
//////////////////////////////////////////////////////////////////////////////////////////

let themeLoader                = null;
let iconCacheMap               = new Map();
const MAX_CACHED_ITEMS         = 1000;
const BATCH_SIZE_TO_DELETE     = 50;
const DOMINANT_COLOR_ICON_SIZE = 64;

var DominantColorExtractor = class {

  constructor(app) {
    this._app = app;
  }

  // Try to get the pixel buffer for the current icon, if not fail gracefully
  _getIconPixBuf() {
    let iconTexture = this._app.create_icon_texture(16);

    if (themeLoader === null) {
      let ifaceSettings = new Gio.Settings({schema: 'org.gnome.desktop.interface'});

      themeLoader = new Gtk.IconTheme(),
      themeLoader.set_custom_theme(
        ifaceSettings.get_string('icon-theme'));  // Make sure the correct theme is loaded
    }

    // Unable to load the icon texture, use fallback
    if (iconTexture instanceof St.Icon === false) {
      return null;
    }

    iconTexture = iconTexture.get_gicon();

    // Unable to load the icon texture, use fallback
    if (iconTexture === null) {
      return null;
    }

    if (iconTexture instanceof Gio.FileIcon) {
      // Use GdkPixBuf to load the pixel buffer from the provided file path
      return GdkPixbuf.Pixbuf.new_from_file(iconTexture.get_file().get_path());
    }

    // Get the pixel buffer from the icon theme
    if (iconTexture instanceof Gio.ThemedIcon) {
      let icon_info =
        themeLoader.lookup_icon(iconTexture.get_names()[0], DOMINANT_COLOR_ICON_SIZE, 0);
      if (icon_info !== null) return icon_info.load_icon();
    }

    return null;
  }

  // The backlight color choosing algorithm was mostly ported to javascript from the
  // Unity7 C++ source of Canonicals:
  // https://bazaar.launchpad.net/~unity-team/unity/trunk/view/head:/launcher/LauncherIcon.cpp
  // so it more or less works the same way.
  _getColorPalette() {
    if (iconCacheMap.get(this._app.get_id())) {
      // We already know the answer
      return iconCacheMap.get(this._app.get_id());
    }

    let pixBuf = this._getIconPixBuf();
    if (pixBuf == null) return null;

    let pixels = pixBuf.get_pixels(), offset = 0;

    let total = 0, rTotal = 0, gTotal = 0, bTotal = 0;

    let resample_y = 1, resample_x = 1;

    // Resampling of large icons
    // We resample icons larger than twice the desired size, as the resampling
    // to a size s
    // DOMINANT_COLOR_ICON_SIZE < s < 2*DOMINANT_COLOR_ICON_SIZE,
    // most of the case exactly DOMINANT_COLOR_ICON_SIZE as the icon size is tipycally
    // a multiple of it.
    let width  = pixBuf.get_width();
    let height = pixBuf.get_height();

    // Resample
    if (height >= 2 * DOMINANT_COLOR_ICON_SIZE)
      resample_y = Math.floor(height / DOMINANT_COLOR_ICON_SIZE);

    if (width >= 2 * DOMINANT_COLOR_ICON_SIZE)
      resample_x = Math.floor(width / DOMINANT_COLOR_ICON_SIZE);

    if (resample_x !== 1 || resample_y !== 1)
      pixels = this._resamplePixels(pixels, resample_x, resample_y);

    // computing the limit outside the for (where it would be repeated at each iteration)
    // for performance reasons
    let limit = pixels.length;
    for (let offset = 0; offset < limit; offset += 4) {
      let r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2],
          a = pixels[offset + 3];

      let saturation = (Math.max(r, g, b) - Math.min(r, g, b));
      let relevance  = 0.1 * 255 * 255 + 0.9 * a * saturation;

      rTotal += r * relevance;
      gTotal += g * relevance;
      bTotal += b * relevance;

      total += relevance;
    }

    total = total * 255;

    let r = rTotal / total, g = gTotal / total, b = bTotal / total;

    let hsv = ColorUtils.RGBtoHSV(r * 255, g * 255, b * 255);

    if (hsv.s > 0.15) hsv.s = 0.65;
    hsv.v = 0.90;

    let rgb = ColorUtils.HSVtoRGB(hsv.h, hsv.s, hsv.v);

    // Cache the result.
    let backgroundColor = {
      lighter: ColorUtils.colorLuminance(rgb.r, rgb.g, rgb.b, 0.2),
      original: ColorUtils.colorLuminance(rgb.r, rgb.g, rgb.b, 0),
      darker: ColorUtils.colorLuminance(rgb.r, rgb.g, rgb.b, -0.5)
    };

    if (iconCacheMap.size >= MAX_CACHED_ITEMS) {
      // delete oldest cached values (which are in order of insertions)
      let ctr = 0;
      for (let key of iconCacheMap.keys()) {
        if (++ctr > BATCH_SIZE_TO_DELETE) break;
        iconCacheMap.delete(key);
      }
    }

    iconCacheMap.set(this._app.get_id(), backgroundColor);

    return backgroundColor;
  }

  // Downsample large icons before scanning for the backlight color to
  // improve performance.
  _resamplePixels(pixels, resampleX, resampleY) {
    let resampledPixels = [];
    // computing the limit outside the for (where it would be repeated at each iteration)
    // for performance reasons
    let limit = pixels.length / (resampleX * resampleY) / 4;
    for (let i = 0; i < limit; i++) {
      let pixel = i * resampleX * resampleY;

      resampledPixels.push(pixels[pixel * 4]);
      resampledPixels.push(pixels[pixel * 4 + 1]);
      resampledPixels.push(pixels[pixel * 4 + 2]);
      resampledPixels.push(pixels[pixel * 4 + 3]);
    }

    return resampledPixels;
  }
};