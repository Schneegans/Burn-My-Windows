# Changelog of the Burn-My-Windows Extension

## [Burn My Window 10](https://github.com/schneegans/Burn-My-Windows/releases/tag/v10)

**Release Date:** TBD

#### New Features

* **New Effect: Broken Glass.** Shatter your windows into a shower sharp shards! This effect can be configured so that the shards fly away from your mouse pointer position!
* The effect-configuration pages of the preferences dialog now have **Preview Buttons** which con be used to, well, preview the current settings (without having to enable the effect first).

#### Other Enhancements

* Added a menu entry with a link to the guide for creating new effect types.
* Added a new option to the Matrix Effect: **Vertical Overshooting**: This can add some vertical variation to the start and end position of the letter drops.

## [Burn My Window 9](https://github.com/schneegans/Burn-My-Windows/releases/tag/v9)

**Release Date:** 2022-01-18

#### Fixes

* Improved compatibility with [Show Application View When Workspace Empty ](https://extensions.gnome.org/extension/2036/show-application-view-when-workspace-empty/) (#54).
* Fixed a crash which happened when the window-close icon in the overview was clicked twice (#49).

## [Burn My Window 8](https://github.com/schneegans/Burn-My-Windows/releases/tag/v8)

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


## [Burn My Window 7](https://github.com/schneegans/Burn-My-Windows/releases/tag/v7)

**Release Date:** 2022-01-03

#### New Features

* An option to use a 3D noise for the fire shader has been added. This will add some more temporal variation to the flames at the cost of slightly decreased rendering performance.
* A changelog entry has been added to the menu of the preferences dialog.

#### Fixes

* Resolve copyright issues by using a MIT-licensed noise implementation.


## [Burn My Window 6](https://github.com/schneegans/Burn-My-Windows/releases/tag/v6)

**Release Date:** 2022-01-02

#### Fixes

* Removed a debug log message.

## [Burn My Window 5](https://github.com/schneegans/Burn-My-Windows/releases/tag/v5)

**Release Date:** 2022-01-02

#### New Features

* Added a new ridiculous close-animation: the T-Rex-Attack!
* Added a new simple close-animation: the TV-Effect!
* Added a menu to the preferences dialog with links for bug reporting and donations.

#### Other Enhancements

* The fire shader now uses a `smoothstep` to make it less blocky.

#### Bug Fixes

* Fixed a bug which messed up the overview of GNOME Shell 3.36.

## [Burn My Window 4](https://github.com/schneegans/Burn-My-Windows/releases/tag/v4)

**Release Date:** 2021-12-25

#### New Features

* Added a new Matrix shader which dissolves your windows in a shower of green letters. You can switch between the fire and the matrix shader in the settings. Sadly, this effect cannot be available under GNOME 3.3x as it was apparently impossible to set textures for a `Clutter.ShaderEffect` in GJS back then.
* Added a setting to apply the animation also for closing dialog windows.

#### Other Enhancements

* Refactored the code a lot to make it easier to add new shader effects in the future.
* Tweaked timing of the fire shader. Previously, the fire became invisible quite quickly. Due to this new animation timing, the default animation time has been reduced to 1500 ms.

## [Burn My Window 3](https://github.com/schneegans/Burn-My-Windows/releases/tag/v3)

**Release Date:** 2021-12-20

#### New Features

* Add support for GNOME 3.36 and GNOME 3.38.

## [Burn My Window 2](https://github.com/schneegans/Burn-My-Windows/releases/tag/v2)

**Release Date:** 2021-12-16

#### New Features

* Added the possibility to adjust fire colors.
* Added the possibility to adjust flame speed and scale.
* Added some fire presets.

## [Burn My Window 1](https://github.com/schneegans/Burn-My-Windows/releases/tag/v1)

**Release Date:** 2021-12-14

* Initial publication on GitHub supporting GNOME 40 and GNOME 41.
