#!/bin/bash

# -------------------------------------------------------------------------------------- #
#           )                                                   (                        #
#        ( /(   (  (               )    (       (  (  (         )\ )    (  (             #
#        )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (         #
#       ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\        #
#       | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)       #
#       | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<       #
#       |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/       #
#                                  |__/                                                  #
# -------------------------------------------------------------------------------------- #

# SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
# SPDX-License-Identifier: MIT

# This script is used to generate the reference images required for the run-tests.sh
# script. To do this, it installs the extension in a fedora-based container running GNOME
# Shell on xvfb. It requires the burn-my-windows@schneegans.github.com.zip file which is
# expected to be present in the repository root. Therefore you have to call "make" before
# this script.
#
# The scripts supports two arguments:
#
# -v fedora_version: This determines the version of GNOME Shell to test agains.
#                    -v 32: GNOME Shell 3.36
#                    -v 33: GNOME Shell 3.38
#                    -v 34: GNOME Shell 40
#                    -v 35: GNOME Shell 41
#                    -v 36: GNOME Shell 42
#                    -v 37: GNOME Shell 43
#                    -v 38: GNOME Shell 44
#                    -v rawhide: The current GNOME Shell version of Fedora Rawhide
# -s session:        This can either be "gnome-xsession" or "gnome-wayland-nested".

# Exit on error.
set -e

usage() {
  echo "Usage: $0 -v fedora_version -s session" >&2
}

FEDORA_VERSION=33
SESSION="gnome-xsession"

while getopts "v:s:h" opt; do
  case $opt in
    v) FEDORA_VERSION="${OPTARG}";;
    s) SESSION="${OPTARG}";;
    h) usage; exit 0;;
    *) usage; exit 1;;
  esac
done

# Go to the repo root.
cd "$( cd "$( dirname "$0" )" && pwd )/.." || \
  { echo "ERROR: Could not find the repo root."; exit 1; }

IMAGE="ghcr.io/schneegans/gnome-shell-pod-${FEDORA_VERSION}"
EXTENSION="burn-my-windows@schneegans.github.com"

# All references images of the effects are captured at & cropped to this region
# in the center of the screen. This is kind of arbitrary, but has been choosen so that
# something is visible from each effect.
EFFECT_CROP="100x100+900+500"
PREFS_CROP="100x100+700+300"

# Run the container. For more info, visit https://github.com/Schneegans/gnome-shell-pod.
POD=$(podman run --rm --cap-add=SYS_NICE --cap-add=IPC_LOCK -td "${IMAGE}")

# Properly shutdown podman when this script is exited.
quit() {
  podman kill "${POD}"
  wait
}

trap quit INT TERM EXIT

# -------------------------------------------------------------------------------- methods

# This function is used below to execute any shell command inside the running container.
do_in_pod() {
  podman exec --user gnomeshell --workdir /home/gnomeshell "${POD}" set-env.sh "$@"
}

# This simulates the given keystroke in the container. Simply calling "xdotool key $1"
# sometimes fails to be recognized. Maybe the default 12ms between key-down and key-up
# are too short for xvfb...
send_keystroke() {
  do_in_pod xdotool keydown "${1}"
  sleep 0.5
  do_in_pod xdotool keyup "${1}"
}

# This can be used to set a gsettings key of the extension.
set_setting() {
  do_in_pod gsettings --schemadir /home/gnomeshell/.local/share/gnome-shell/extensions/burn-my-windows@schneegans.github.com/schemas \
                      set org.gnome.shell.extensions.burn-my-windows "${1}" "${2}"
}

# This makes a screen capture (cropped to either $EFFECT_CROP or P$REFS_CROP as given through the
# second parameter) inside the container and stores it on the host relative to this script with the
# given file name.
capture() {
  podman cp "${POD}:/opt/Xvfb_screen0" - | tar xf - --to-command "convert xwd:- -crop ${2} ${1}"
}

# This opens the extensions preferences dialog and captures two images: One during the
# window-open animation, and one during the window-close animation. The sleeps are a bit
# excessive, but it's difficult to get consistent results with shorter sleeps. The
# animations are shown for five seconds, so we also have to make sure that one animation
# is finished before starting the next one.
capture_effect() {
  echo "Capturing ${1} effect."

  set_setting "preview-effect" "${1}"

  sleep 1
  do_in_pod gnome-terminal
  sleep 3
  capture "tests/references/${1}-open-${SESSION}-${FEDORA_VERSION}.png" "${EFFECT_CROP}"
  send_keystroke "Alt+F4"
  sleep 3
  capture "tests/references/${1}-close-${SESSION}-${FEDORA_VERSION}.png" "${EFFECT_CROP}"
}


# -------------------------------------------------------------- set GSK_RENDERER to cairo

echo "Make sure to use Cairo GTK rendering backend."
do_in_pod 'echo "export GSK_RENDERER=cairo" >> .bash_profile'


# ----------------------------------------------------- wait for the container to start up

echo "Waiting for D-Bus."
do_in_pod wait-user-bus.sh > /dev/null 2>&1


# ----------------------------------------------------- install the to-be-tested extension

echo "Installing extension."
podman cp "tests/references" "${POD}:/home/gnomeshell/references"
podman cp "${EXTENSION}.zip" "${POD}:/home/gnomeshell"
do_in_pod gnome-extensions install "${EXTENSION}.zip"


# ---------------------------------------------------------------------- start GNOME Shell

# Starting with GNOME 40, there is a "Welcome Tour" dialog popping up at first launch.
# We disable this beforehand.
if [[ "${FEDORA_VERSION}" -gt 33 ]] || [[ "${FEDORA_VERSION}" == "rawhide" ]]; then
  echo "Disabling welcome tour."
  do_in_pod gsettings set org.gnome.shell welcome-dialog-last-shown-version "999" || true
fi

# Make sure that new windows are opened in the center.
do_in_pod gsettings set org.gnome.mutter center-new-windows true

echo "Starting $(do_in_pod gnome-shell --version)."
do_in_pod systemctl --user start "${SESSION}@:99"
sleep 10

# Enable the extension.
do_in_pod gnome-extensions enable "${EXTENSION}"

# Starting with GNOME 40, the overview is the default mode. We close this here by hitting
# the super key.
if [[ "${FEDORA_VERSION}" -gt 33 ]] || [[ "${FEDORA_VERSION}" == "rawhide" ]]; then
  echo "Closing Overview."
  send_keystroke "super"
fi

# Wait until the extension is enabled and the overview closed.
sleep 3


# --------------------------------------------------------------------- capture the images

# First we open the preferences and capture a portion of the dialog
echo "Opening Preferences."
do_in_pod gnome-extensions prefs "${EXTENSION}"
sleep 3
capture "tests/references/preferences-${SESSION}-${FEDORA_VERSION}.png" "${PREFS_CROP}"
send_keystroke "Alt+F4"

# The test mode ensures that the animations are "frozen" and do not change in time.
echo "Entering test mode."
set_setting "test-mode" true

capture_effect "energize-a"
capture_effect "energize-b"
capture_effect "fire"
capture_effect "glide"
capture_effect "glitch"
capture_effect "hexagon"
capture_effect "incinerate"
capture_effect "pixelate"
capture_effect "pixel-wheel"
capture_effect "pixel-wipe"
capture_effect "portal"
capture_effect "tv"
capture_effect "tv-glitch"
capture_effect "wisps"

if [[ "${FEDORA_VERSION}" -gt 32 ]] || [[ "${FEDORA_VERSION}" == "rawhide" ]]; then
  capture_effect "apparition"
  capture_effect "doom"
fi

if [[ "${FEDORA_VERSION}" -gt 33 ]] || [[ "${FEDORA_VERSION}" == "rawhide" ]]; then
  capture_effect "trex"
  capture_effect "broken-glass"
  capture_effect "matrix"
  capture_effect "snap"
fi

echo "All reference images generated successfully."
