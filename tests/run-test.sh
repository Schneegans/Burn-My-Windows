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

# This script executes several automated tests on Burn-My-Windows. To do this, it is
# installed in a fedora-based container running GNOME Shell on xvfb. The used container is
# hosted on Github: https://github.com/Schneegans/gnome-shell-pod. This scripts installs
# Burn-My-Windows from the burn-my-windows@schneegans.github.com.zip file which is
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

# Run the container. For more info, visit https://github.com/Schneegans/gnome-shell-pod.
POD=$(podman run --rm --cap-add=SYS_NICE --cap-add=IPC_LOCK -td "${IMAGE}")

# Create a temporary directory.
WORK_DIR=$(mktemp -d)
if [[ ! "${WORK_DIR}" || ! -d "${WORK_DIR}" ]]; then
  echo "Failed to create tmp directory!" >&2
  exit 1
fi

# Properly shutdown podman when this script is exited.
quit() {
  rm -r "${WORK_DIR}"
  podman kill "${POD}"
  wait
}

trap quit INT TERM EXIT

# -------------------------------------------------------------------------------- methods

# This function is used below to execute any shell command inside the running container.
do_in_pod() {
  podman exec --user gnomeshell --workdir /home/gnomeshell "${POD}" set-env.sh "$@"
}

# This is called whenever a test fails. It prints an error message (given as second
# parameter), saves a current screenshot, the current cropped target and a log to
# "tests/output/".
fail() {
  echo "${2}"
  mkdir -p "tests/output"
  mv "${WORK_DIR}/screen.png" "tests/output/${1}"
  LOG=$(do_in_pod sudo journalctl)
  echo "${LOG}" > tests/output/fail.log
  exit 1
}

# This searches the virtual screen of the container for a given target image (first
# parameter). If it is not found, an error message (second paramter) is printed and the
# script exits via the fail() method above.
find_target() {
  echo "Searching for ${1} on the screen."

  podman cp "${POD}:/opt/Xvfb_screen0" - | tar xf - --to-command "convert xwd:- ${WORK_DIR}/screen.png"

  POS=$(./tests/find-target.sh "${WORK_DIR}/screen.png" "tests/references/${1}") || true

  if [[ -z "${POS}" ]]; then
    fail "${1}" "${2}"
  fi
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

# This opens the extensions preferences dialog and captures two images: One during the
# window-open animation, and one during the window-close animation. For each capture, a
# reference image is searched. The sleeps are a bit excessive, but it's difficult to get
# consistent results with shorter sleeps. The animations are shown for five seconds, so
# we also have to make sure that one animation is finished before starting the next one.
test_effect() {
  echo "Testing ${1} effect."

  set_setting "preview-effect" "${1}"

  sleep 1
  do_in_pod gnome-terminal
  sleep 3
  find_target "${1}-open-${SESSION}-${FEDORA_VERSION}.png" "Failed to test ${1} window open effect!"
  send_keystroke "Alt+F4"
  sleep 3
  find_target "${1}-close-${SESSION}-${FEDORA_VERSION}.png" "Failed to test ${1} window close effect!"
}

# -------------------------------------------------------------- set GSK_RENDERER to cairo

echo "Make sure to use Cairo GTK rendering backend."
do_in_pod 'echo "export GSK_RENDERER=cairo" >> .bash_profile'


# ----------------------------------------------------- wait for the container to start up

echo "Waiting for D-Bus."
do_in_pod wait-user-bus.sh > /dev/null 2>&1


# ----------------------------------------------------- install the to-be-tested extension

echo "Installing extension."
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

# ---------------------------------------------------------------------- perform the tests

# First we open the preferences and check whether the window is shown on screen by
# searching for a small snippet of the preferences dialog.
echo "Opening Preferences."
do_in_pod gnome-extensions prefs "${EXTENSION}"
sleep 3
find_target "preferences-${SESSION}-${FEDORA_VERSION}.png" "Failed to open preferences!"
send_keystroke "Alt+F4"

# The test mode ensures that the animations are "frozen" and do not change in time.
echo "Entering test mode."
set_setting "test-mode" true

test_effect "energize-a"
test_effect "energize-b"
test_effect "fire"
test_effect "glide"
test_effect "glitch"
test_effect "hexagon"
test_effect "incinerate"
test_effect "pixelate"
test_effect "pixel-wheel"
test_effect "pixel-wipe"
test_effect "portal"
test_effect "tv"
test_effect "tv-glitch"
test_effect "wisps"

if [[ "${FEDORA_VERSION}" -gt 32 ]] || [[ "${FEDORA_VERSION}" == "rawhide" ]]; then
  test_effect "apparition"
  test_effect "doom"
fi

if [[ "${FEDORA_VERSION}" -gt 33 ]] || [[ "${FEDORA_VERSION}" == "rawhide" ]]; then
  test_effect "trex"
  test_effect "broken-glass"
  test_effect "matrix"
  test_effect "snap"
fi

echo "All tests executed successfully."
