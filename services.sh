#!/bin/bash

scriptdir="$(dirname "$0")"
scriptdir="$(cd "$scriptdir" && pwd)"

home="/home/kiosk"

SERVICES="$scriptdir/services/*.conf"
SCRIPTS="$scriptdir/services/*.sh"

sudo cp $SCRIPTS "$home/.emu/services/"
sudo chown -R kiosk:kiosk "$home/.emu/services/"

for service in $SERVICES
do
	filename="$(basename "$service")"
	echo "$(eval "echo -e \"`<$service`\"")" | sudo tee "/etc/init/$filename"
done

