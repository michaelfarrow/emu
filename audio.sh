#!/bin/bash

scriptdir="$(dirname "$0")"
scriptdir="$(cd "$scriptdir" && pwd)"

source "$scriptdir/lib/confirm"

config="/etc/pulse/default.pa"

if [ -z "$(sudo cat "$config" | grep "load-module module-alsa-sink device")" ]
then
	devices_info="$(sudo aplay -l 2>/dev/null)"

	while read -r device_info
	do
		[[ $device_info =~ card[^[:digit:]]*([[:digit:]]+) ]] && card="${BASH_REMATCH[1]}"
		[[ $device_info =~ device[^[:digit:]]*([[:digit:]]+) ]] && device="${BASH_REMATCH[1]}"

		if [ -n "$card" ] && [ -n "$device" ] && [ -z "$found" ]
		then
			echo "Found card: $card, device: $device"
			echo "Playing sound..."
			sudo aplay -D plughw:$card,$device /usr/share/sounds/alsa/Noise.wav > /dev/null /dev/null 2>&1
			confirm "Did you hear noise?" && found="$card,$device"
		fi
	done < <(echo "$devices_info" | grep "card.*device")

	if [ -n "$found" ]
	then
		echo "Output identified: $found"
		echo "Writing config to $config"
		sudo sed -i -e "s/### Load audio drivers statically/### Load audio drivers statically\nload-module module-alsa-sink device=hw:${found}\nload-module module-combine-sink sink_name=combined\nset-default-sink combined/g" "$config"
	fi
else
	echo "Audio device already configured"
fi

