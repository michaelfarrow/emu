#!/bin/bash

rfkill unblock bluetooth
sleep 1

WIIMOTES="/home/kiosk/.emu/config/wiimotes"

if [ -f "$WIIMOTES" ]
then
	while IFS='' read -r mac || [[ -n "$mac" ]]; do
		if [ -n "$mac" ]
		then
			sudo -u kiosk wminput -d -c /home/kiosk/.emu/config/wiimote.conf $mac > /dev/null 2>&1 &
		fi
	done < "$WIIMOTES"
fi
