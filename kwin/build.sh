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

# Exit the script when one command fails.
set -e

# Go to the script's directory.
cd "$( cd "$( dirname "$0" )" && pwd )" || \
  { echo "ERROR: Could not find kwin directory."; exit 1; }

BUILD_DIR="_build"

mkdir -p "${BUILD_DIR}"

generate() {
  cp -r "kwin4_effect_$1" "${BUILD_DIR}"

  mkdir -p "${BUILD_DIR}/kwin4_effect_$1/contents/shaders"
  mkdir -p "${BUILD_DIR}/kwin4_effect_$1/contents/code"

  sed -e "s;%NICK%;$1;g" -e "s;%NAME%;$2;g" -e "s;%DESCRIPTION%;$3;g" \
    metadata.desktop.in > "${BUILD_DIR}/kwin4_effect_$1/metadata.desktop"

  sed -e "s;%NICK%;$1;g" -e "s;%NAME%;$2;g" -e "s;%DESCRIPTION%;$3;g" \
    main.js.in > "${BUILD_DIR}/kwin4_effect_$1/contents/code/main.js"

}

generate "tv" "TV" "Make windows close like turning off a TV"
# generate "fire" "Fire" "Make windows burn"