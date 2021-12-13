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

# This scripts counts the lines of code and comments in all JavaScript files.
# The copyright-headers are substracted. It uses the command line tool "cloc".
# All dumb comments like those /////////// or those // ------------ are also substracted.
# You can either pass --loc, --comments or  --percentage to show the respective values
# only.

# Exit the script when one command fails.
set -e

# Go to the repo root.
cd "$( cd "$( dirname "$0" )" && pwd )/.." || \
  { echo "ERROR: Could not find the repo root."; exit 1; }

# Run cloc - this counts code lines, blank lines and comment lines for the specified
# languages. We are only interested in the summary, therefore the tail -1
SUMMARY="$(cloc . --include-lang="JavaScript" --md | tail -1)"

# The $SUMMARY is one line of a markdown table and looks like this:
# SUM:|101|3123|2238|10783
# We use the following command to split it into an array.
IFS='|' read -r -a TOKENS <<< "$SUMMARY"

# Store the individual tokens for better readability.
NUMBER_OF_FILES=${TOKENS[1]}
COMMENT_LINES=${TOKENS[3]}
LINES_OF_CODE=${TOKENS[4]}

# To make the estimate of commented lines more accurate, we have to substract the
# copyright header which is included in each file. This header has the length of ten
# lines. All dumb comments like those /////////// or those // ------------ are also
# substracted. As cloc does not count inline comments, the overall estimate should be
# rather conservative.
DUMB_COMMENTS="$(grep -r -E '//////|// -----' . | wc -l)"
COMMENT_LINES=$((COMMENT_LINES - 10 * NUMBER_OF_FILES - DUMB_COMMENTS))

# Print all results if no arguments are given.
if [[ $# -eq 0 ]] ; then
  awk -v a="$LINES_OF_CODE" \
      'BEGIN {printf "Lines of source code: %6.1fk\n", a/1000}'
  awk -v a=$COMMENT_LINES \
      'BEGIN {printf "Lines of comments:    %6.1fk\n", a/1000}'
  awk -v a=$COMMENT_LINES -v b="$LINES_OF_CODE" \
      'BEGIN {printf "Comment Percentage:   %6.1f%\n", 100*a/(a+b)}'
  exit 0
fi

# Show lines of code.
if [[ "$*" == *--loc* ]]
then
  awk -v a="$LINES_OF_CODE" \
      'BEGIN {printf "%.1fk\n", a/1000}'
fi

# Show lines of comments.
if [[ "$*" == *--comments* ]]
then
  awk -v a=$COMMENT_LINES \
      'BEGIN {printf "%.1fk\n", a/1000}'
fi

# Show precentage of comments.
if [[ "$*" == *--percentage* ]]
then
  awk -v a=$COMMENT_LINES -v b="$LINES_OF_CODE" \
      'BEGIN {printf "%.1f\n", 100*a/(a+b)}'
fi
