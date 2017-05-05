#!/bin/bash

scriptdir="$(dirname "$0")"
scriptdir="$(cd "$scriptdir" && pwd)"

#source "$scriptdir/wifi.sh"
#source "$scriptdir/packages.sh"
#source "$scriptdir/users.sh"
#source "$scriptdir/fs.sh"
source "$scriptdir/theme.sh"
#source "$scriptdir/services.sh"
source "$scriptdir/config.sh"
source "$scriptdir/wiimote.sh"
source "$scriptdir/joypads.sh"
source "$scriptdir/audio.sh"
source "$scriptdir/scraper.sh"
#source "$scriptdir/kiosk.sh"
