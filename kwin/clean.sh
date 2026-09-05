#!/bin/sh

# Go to the script's directory.
cd "$( cd "$( dirname "$0" )" && pwd )" || \
  { echo "ERROR: Could not find kwin directory."; exit 1; }
# Remove build dir
rm -Rf _build
# Remove files
rm -f kwin5*.tar.gz
rm -f kwin6*.tar.gz
rm -f burn_my_windows_kwin6.tar.gz
rm -f burn_my_windows_kwin5.tar.gz
