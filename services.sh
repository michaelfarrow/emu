#!/bin/bash

scriptdir="$(dirname "$0")"
scriptdir="$(cd "$scriptdir" && pwd)"

home="/home/kiosk"

SERVICES="$scriptdir/services/*.conf"
SCRIPTS="$scriptdir/services/*.sh"

sudo cp $SCRIPTS "$home/.emu/services/"
sudo cp -r "$scriptdir/services/tidy" "$home/.emu/services"

sudo chown -R kiosk:kiosk "$home/.emu/services/"
sudo -u kiosk HOME="$home" bash -c "cd $home/.emu/services/tidy && npm install"

for service in $SERVICES
do
	filename="$(basename "$service")"
	echo "$(eval "echo -e \"`<$service`\"")" | sudo tee "/etc/init/$filename"
done

