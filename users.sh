#!/bin/bash

sudo adduser kiosk
sudo usermod -a -G audio kiosk
sudo usermod -a -G video kiosk
sudo usermod -a -G input kiosk

sudoers="/etc/sudoers"
cmds="kiosk ALL=(ALL) NOPASSWD:ALL"

[ -z "$(sudo grep "$cmds" "$sudoers")" ] && echo "$cmds" | sudo tee -a "$sudoers"
