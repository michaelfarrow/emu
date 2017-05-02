#!/bin/bash

sudo tee /etc/udev/rules.d/wiimote.rules <<- EOF
	KERNEL=="uinput", MODE="0666"
EOF

if [ -z "$(sudo cat /etc/modules | grep uinput)" ]
then
	echo "uinput" | sudo tee -a /etc/modules
fi

if [ -z "$(sudo cat /etc/modules | grep hid-wiimote)" ]
then
	echo "hid-wiimote" | sudo tee -a /etc/modules
fi
