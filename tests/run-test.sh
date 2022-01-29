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
#                        Copyright (c) 2021 Simon Schneegans                             #
#           Released under the GPLv3 or later. See LICENSE file for details.             #
# -------------------------------------------------------------------------------------- #

# This script is based on a similar script from the Fly-Pie GNOME Shell extension which is
# published under the MIT License (https://github.com/Schneegans/Fly-Pie).

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

# This is called whenever a test fails. It prints an error message (given as first
# parameter), captures a screenshot to "fail.png" and stores a log in "fail.log".
fail() {
  echo "${1}"
  podman cp "${POD}:/opt/Xvfb_screen0" - | tar xf - --to-command 'convert xwd:- fail.png'
  LOG=$(do_in_pod sudo journalctl | grep -C 5 "error\|gjs")
  echo "${LOG}" > fail.log
  exit 1
}

# This searches the virtual screen of the container for a given target image (first
# parameter). If it is not found, an error message (second paramter) is printed and the
# script exits via the fail() method above.
find_target() {
  echo "Looking for ${1} on the screen."
  POS=$(do_in_pod find-target.sh "${1}") || true
  if [[ -z "${POS}" ]]; then
    fail "${2}"
  fi
}

# This searches the virtual screen of the container for a given target image (first
# parameter) and moves the mouse to the upper left corner of the best match. If the target
# image is not found, an error message (second paramter) is printed and the script exits
# via the fail() method above.
move_mouse_to_target() {
  echo "Trying to move mouse to ${1}."
  POS=$(do_in_pod find-target.sh "${1}") || true
  if [[ -z "${POS}" ]]; then
    fail "${2}"
  fi

  # shellcheck disable=SC2086
  do_in_pod xdotool mousemove $POS
}

# This simulates the given keystroke in the container. Simply calling "xdotool key $1"
# sometimes fails to be recognized. Maybe the default 12ms between key-down and key-up
# are too short for xvfb...
send_keystroke() {
  do_in_pod xdotool keydown "${1}"
  sleep 0.5
  do_in_pod xdotool keyup "${1}"
}

# This simulates a mouse click in the container. Simply calling "xdotool click $1"
# sometimes fails to be recognized. Maybe the default 12ms between button-down and
# button-up are too short for xvfb...
send_click() {
  do_in_pod xdotool mousedown "${1}"
  sleep 0.5
  do_in_pod xdotool mouseup "${1}"
}


# ----------------------------------------------------- wait for the container to start up

echo "Waiting for D-Bus."
do_in_pod wait-user-bus.sh > /dev/null 2>&1


# ----------------------------------------------------- install the to-be-tested extension

echo "Installing extension."
podman cp "tests/references" "${POD}:/home/gnomeshell/references"
podman cp "${EXTENSION}.zip" "${POD}:/home/gnomeshell"
do_in_pod gnome-extensions install "${EXTENSION}.zip"
do_in_pod gnome-extensions enable "${EXTENSION}"


# ---------------------------------------------------------------------- start GNOME Shell

# Starting with GNOME 40, there is a "Welcome Tour" dialog popping up at first launch.
# We disable this beforehand.
if [[ "${FEDORA_VERSION}" -gt 33 ]]; then
  echo "Disabling welcome tour."
  do_in_pod gsettings set org.gnome.shell welcome-dialog-last-shown-version "999" || true
fi

echo "Starting $(do_in_pod gnome-shell --version)."
do_in_pod systemctl --user start "${SESSION}@:99"
sleep 10

# Starting with GNOME 40, the overview is the default mode. We close this here by hitting
# the super key.
if [[ "${FEDORA_VERSION}" -gt 33 ]]; then
  echo "Closing Overview."
  send_keystroke "super"
  sleep 3
fi


# ---------------------------------------------------------------------- perform the tests

# First we open the preferences and check whether the window is shown on screen by
# searching for a small snippet of the preferences dialog.
echo "Opening Preferences."
do_in_pod gnome-extensions prefs "${EXTENSION}"
sleep 3
find_target "references/preferences.png" "Failed to open preferences!"

echo "All tests executed successfully."
