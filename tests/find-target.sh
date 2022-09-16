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

# This script searches for a given image on the screen and prints the coordinates of the
# upper left corner to STDOUT if it's found. If the image is not found, an exit code
# of 1 is returned.

# -s scale_factor: In order to optimize the performance, both, the target image and the
#                  screen capture is scaled down by 1 / scale_factor. Lower numbers can
#                  help finding difficult targets but will also increase the calculation
#                  time. Reasonable values are [1...10], default is 4.
# -f fuzziness:    A mean-squared-error threshold under which a location is considered
#                  to be a match. Default is 0.01. Increase this to make finding a
#                  target more likely but also increase the possibility of false
#                  positives.

usage() {
  echo "Usage: $0 -s scale_factor -f fuzziness screen.png target.png" >&2
}

SCALE_FACTOR=4
FUZZINESS=0.01

while getopts "s:f:h" opt; do
  case $opt in
    s) SCALE_FACTOR="${OPTARG}";;
    f) FUZZINESS="${OPTARG}";;
    h) usage; exit 0;;
    *) usage; exit 1;;
  esac
done

shift $((OPTIND-1))
SCREEN=$1
TARGET=$2

# Make sure the screen image is given.
if [[ -z "${SCREEN}" ]]; then
    usage
    exit 1
fi

# Make sure the target image is given.
if [[ -z "${TARGET}" ]]; then
    usage
    exit 1
fi

# Create a temporary directory.
WORK_DIR=$(mktemp -d)
if [[ ! "${WORK_DIR}" || ! -d "${WORK_DIR}" ]]; then
  echo "Failed to create tmp directory!" >&2
  exit 1
fi

# Deletes the temp directory on exit.
function cleanup {
  rm -r "${WORK_DIR}"
}

trap cleanup EXIT

# Reduce the size of the screen capture and the target to optimize the search performance.
convert "${SCREEN}" -resize $((100 / SCALE_FACTOR))% "${WORK_DIR}/screen_small.png"
convert "${TARGET}" -resize $((100 / SCALE_FACTOR))% "${WORK_DIR}/target_small.png"

# Make a search on the reduced images.
RESULT=$(compare -metric MSE -subimage-search \
      "${WORK_DIR}/screen_small.png" "${WORK_DIR}/target_small.png" "${WORK_DIR}/out.png" 2>&1)

if [[ $RESULT == *"error"* ]]; then
  echo "Failed to find the target: ${RESULT}" >&2
  exit 1
fi

# We use the position of match to crop the original screen capture tightly around the
# match. Some padding is added to make sure that the target is contained in the cropped
# screen capture. We then search one more in the full resolution to get the exact pixel
# location.

# Here we extract the pixel location of the match in the scaled-down version.
CROP_X=$(echo "${RESULT}" | awk -F[\,\ ] '{print $4}')
CROP_Y=$(echo "${RESULT}" | awk -F[\,\ ] '{print $5}')

# We add more padding if the images are more scaled down.
PADDING=$SCALE_FACTOR

CROP_X=$((CROP_X * SCALE_FACTOR - PADDING))
CROP_Y=$((CROP_Y * SCALE_FACTOR - PADDING))

# Clamp the result.
CROP_X=$((CROP_X < 0 ? 0 : CROP_X))
CROP_Y=$((CROP_Y < 0 ? 0 : CROP_Y))

# The crop size depends on the target image size.
TARGET_WIDTH=$(identify -format "%[fx:w]" "${TARGET}")
TARGET_HEIGHT=$(identify -format "%[fx:h]" "${TARGET}")
CROP_WIDTH=$((TARGET_WIDTH + 2*PADDING))
CROP_HEIGHT=$((TARGET_HEIGHT + 2*PADDING))

# Perform the crop.
convert "${SCREEN}" -crop ${CROP_WIDTH}x${CROP_HEIGHT}+${CROP_X}+${CROP_Y} \
        +repage "${WORK_DIR}/screen_cropped.png"

# Search again on the full resolution.
RESULT=$(compare -metric MSE -dissimilarity-threshold "${FUZZINESS}" -subimage-search \
      "${WORK_DIR}/screen_cropped.png" "${TARGET}" "${WORK_DIR}/out.png" 2>&1)

if [[ $RESULT == *"error"* ]]; then
  echo "Failed to find the target: ${RESULT}" >&2
  exit 1
fi

# Extract the pixel location from the result. This is now relative to the crop position.
POS_X=$(echo "${RESULT}" | awk -F[\,\ ] '{print $4}')
POS_Y=$(echo "${RESULT}" | awk -F[\,\ ] '{print $5}')

# Therefore we have to add the crop position to the result.
POS_X=$((POS_X + CROP_X))
POS_Y=$((POS_Y + CROP_Y))

# Finally print our result.
echo "$POS_X $POS_Y"
