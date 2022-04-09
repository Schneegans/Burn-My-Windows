# Changelog of the Burn-My-Windows Extension

## [Burn My Windows 16](https://github.com/schneegans/Burn-My-Windows/releases/tag/v16)

**Release Date:** TBD

#### Bug Fixes

* There seem to be cases were `libadwaita` is not available on GNOME 42 (e.g. Pop!_OS 22.04 beta). The preferences dialog now tries to fallback to the GTK4-only variant if `libadwaita` is not available.

## [Burn My Windows 15](https://github.com/schneegans/Burn-My-Windows/releases/tag/v15)

**Release Date:** 2022-04-06

#### New Features

* **New Effect: Apparition.** This effect hides the window by violently sucking it into the void of magic. This is available only for GNOME Shell 3.38 and newer.
* **New Effect: Hexagon.** With glowing lines and hexagon-shaped tiles, this effect looks very sci-fi. This is available for GNOME Shell 3.36 and newer.
* **New Effect: Snap of Disintegration.** This was requested quite frequently! Dissolve your windows into a cloud of dust. This is available only for GNOME Shell 40 and newer.

#### Bug Fixes

* Disabled the buggy "Shatter from pointer" option of the Broken Glass effect when opening windows (it only makes sense for closing windows).

## [Burn My Windows 14](https://github.com/schneegans/Burn-My-Windows/releases/tag/v14)

**Release Date:** 2022-03-29

#### Enhancements

* Reduced the lower animation time limits for all effects to 100 ms. This should now allow for very snappy animations!
* A completely new Russian translation. Thank you, ANIGO R.!

#### Bug Fixes

* Fixed the version check for GNOME Shell `42.rc` (before it only worked on `42.alpha` and `42.beta`)


## [Burn My Windows 13](https://github.com/schneegans/Burn-My-Windows/releases/tag/v13)

**Release Date:** 2022-03-27

#### Enhancements

* The continuous integration tests have been significantly enhanced. Now, all window-open and window-close animations are visually tested on all supported GNOME versions and on X11 / Wayland (summing up to a total of 136 test cases).
* Many translation updates, including a completely new Turkish and Chinese translation. A BIG THANKS to all translators!

#### Other Changes

* Removed the Liberapay donation option as it does not work properly.

#### Bug Fixes

* Fixed the version check for GNOME Shell 42.

## [Burn My Windows 12](https://github.com/schneegans/Burn-My-Windows/releases/tag/v12)

**Release Date:** 2022-02-19

#### New Features

* Added initial support for GNOME Shell 42.
* The preferences dialog now uses libadwaita on GNOME Shell 42.

#### Enhancements

* Added [Liberapay](https://liberapay.com/Schneegans) to the sponsorship options.

## [Burn My Windows 11](https://github.com/schneegans/Burn-My-Windows/releases/tag/v11)

**Release Date:** 2022-02-03

#### New Features

* Added an about-dialog which shows all translators and sponsors.

#### Enhancements

* There are several new translations! Thanks a lot to all the translators! We now have translations for:
  * German
  * English
  * Czech
  * Dutch
  * French
  * Italian
  * Norwegian Bokmål
  * Spanish
* A new issue template for suggesting new effects has been added.

#### Fixes

* Fixed an issue which caused corrupted windows when trying to maximize windows while the window-open animation was still running (#82, #86, #91).

## [Burn My Windows 10](https://github.com/schneegans/Burn-My-Windows/releases/tag/v10)

**Release Date:** 2022-01-31

#### New Features

<a href="https://youtu.be/L2aaNF_rPHo"><img align="right" src ="pics/bmw10.jpg" /></a>

* **Effects for Window Opening.** You can now select effects which are applied on newly opened windows! I expect that there are some bugs left, so please [report any issue you find](https://github.com/Schneegans/Burn-My-Windows/issues)!
* **New Effect: Broken Glass.** Shatter your windows into a shower sharp shards! This effect can be configured so that the shards fly away from your mouse pointer position!
* **Preview Buttons** have been added to the effect-configuration pages of the preferences dialog. These can be used to, well, preview the current settings (without having to enable the effect first).
* **Translations!** It is now possible to [translate the preferences dialog](https://hosted.weblate.org/engage/burn-my-windows/). There is already a finished German translation, and in-progress translations to Italian and Norwegian Bokmål.
* **A "Vertical Overshooting" option** was added to the Matrix Effect: This can add some vertical variation to the start and end position of the letter drops.

#### Other Enhancements

* Added a menu entry with a link to the guide for creating new effect types.
* Thanks to improved timing, the default animation time of several effects could be reduced.
* The README now shows the current lines of code and the current comment percentage using my [dynamic-badges-action](https://github.com/Schneegans/dynamic-badges-action).
* **Add advanced CI tests:** For each commit to `main`, it is now tested whether the extension can be installed and if the preferences dialog can be shown on GNOME Shell 3.36, 3.38, 40, and 41. Both, X11 and Wayland are checked. 

## [Burn My Windows 9](https://github.com/schneegans/Burn-My-Windows/releases/tag/v9)

**Release Date:** 2022-01-18

#### Fixes

* Improved compatibility with [Show Application View When Workspace Empty ](https://extensions.gnome.org/extension/2036/show-application-view-when-workspace-empty/) (#54).
* Fixed a crash which happened when the window-close icon in the overview was clicked twice (#49).

## [Burn My Windows 8](https://github.com/schneegans/Burn-My-Windows/releases/tag/v8)

**Release Date:** 2022-01-17

#### New Features

* **Random effects!** You can now select a set of effects of which one will be chosen randomly whenever you close a window. **This changes how effects are selected, so you will have to re-select your desired effect(s)**.
* **New Effect: Energize A.** Beam your windows away!
* **New Effect: Energize B.** Using different transporter technology results in an alternative visual effect.
* **New Effect: Wisps.** These little fairies carry your windows to the realm of dreams!
* Each effect has its own "Animation Time" setting now. The global animation time has been replaced by those, so **you may have to adjust the sliders to match your previous settings**. 

#### Other Enhancements

* A [guide for creating new effects](how-to-create-new-effects.md) has been added.
* The source code has received a **major refactoring**. This will make the addition of new effects much easier in the future.
* The **layout of the settings dialog** has been reworked to make it easier to expand it in the future.
* The lower limit of the **animation time of the TV Effect** has been reduced.
* The T-Rex-Attack effect is not shown in fully transparent regions of a window any more.
* The shaders now use a different noise implementation which produces better 3D noise.

#### Fixes

* The extension now works even if GNOME Shell's animations are disabled globally.


## [Burn My Windows 7](https://github.com/schneegans/Burn-My-Windows/releases/tag/v7)

**Release Date:** 2022-01-03

#### New Features

* An option to use a 3D noise for the fire shader has been added. This will add some more temporal variation to the flames at the cost of slightly decreased rendering performance.
* A changelog entry has been added to the menu of the preferences dialog.

#### Fixes

* Resolve copyright issues by using a MIT-licensed noise implementation.


## [Burn My Windows 6](https://github.com/schneegans/Burn-My-Windows/releases/tag/v6)

**Release Date:** 2022-01-02

#### Fixes

* Removed a debug log message.

## [Burn My Windows 5](https://github.com/schneegans/Burn-My-Windows/releases/tag/v5)

**Release Date:** 2022-01-02

#### New Features

* Added a new ridiculous close-animation: the T-Rex-Attack!
* Added a new simple close-animation: the TV-Effect!
* Added a menu to the preferences dialog with links for bug reporting and donations.

#### Other Enhancements

* The fire shader now uses a `smoothstep` to make it less blocky.

#### Bug Fixes

* Fixed a bug which messed up the overview of GNOME Shell 3.36.

## [Burn My Windows 4](https://github.com/schneegans/Burn-My-Windows/releases/tag/v4)

**Release Date:** 2021-12-25

#### New Features

* Added a new Matrix shader which dissolves your windows in a shower of green letters. You can switch between the fire and the matrix shader in the settings. Sadly, this effect cannot be available under GNOME 3.3x as it was apparently impossible to set textures for a `Clutter.ShaderEffect` in GJS back then.
* Added a setting to apply the animation also for closing dialog windows.

#### Other Enhancements

* Refactored the code a lot to make it easier to add new shader effects in the future.
* Tweaked timing of the fire shader. Previously, the fire became invisible quite quickly. Due to this new animation timing, the default animation time has been reduced to 1500 ms.

## [Burn My Windows 3](https://github.com/schneegans/Burn-My-Windows/releases/tag/v3)

**Release Date:** 2021-12-20

#### New Features

* Add support for GNOME 3.36 and GNOME 3.38.

## [Burn My Windows 2](https://github.com/schneegans/Burn-My-Windows/releases/tag/v2)

**Release Date:** 2021-12-16

#### New Features

* Added the possibility to adjust fire colors.
* Added the possibility to adjust flame speed and scale.
* Added some fire presets.

## [Burn My Windows 1](https://github.com/schneegans/Burn-My-Windows/releases/tag/v1)

**Release Date:** 2021-12-14

* Initial publication on GitHub supporting GNOME 40 and GNOME 41.
