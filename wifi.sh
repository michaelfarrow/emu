#!/bin/bash

wific="$(iwconfig 2>/dev/null | grep "ESSID")"

if [ -n "$wific" ]
then
	echo "Found wifi adaptor"

	while [ -z "$ssid" ]
	do
		echo -n "SSID: "
		read ssid
	done

	while [ -z "$psk" ]
	do
		echo -n "PSK: "
		read psk
	done

	adaptor="$(echo "$wific" | awk '{print $1;}')"

	psk_res="$(wpa_passphrase $ssid $psk)"

	psk_h="$(echo "$psk_res" | grep psk | tail -n 1 | awk -F "=" '/1/ {print $2;}')"

	cat <<- EOF | sudo tee /etc/network/interfaces.d/wifi
		auto $adaptor
		iface $adaptor inet dhcp
		wpa-ssid $ssid
		wpa-psk $psk_h
	EOF

#	sudo ifup -v $adaptor
fi
