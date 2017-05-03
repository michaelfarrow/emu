#!/bin/bash

home="/home/kiosk"

sudo mkdir -p "$home/.emulationstation"
sudo mkdir -p "$home/.emulationstation/themes"
sudo mkdir -p "$home/.emu"
sudo mkdir -p "$home/.emu/services"
sudo mkdir -p "$home/.emu/config"
sudo mkdir -p "$home/.emu/roms"
sudo mkdir -p "$home/.emu/roms/Nintendo (NES)"
sudo mkdir -p "$home/.config/devilspie2"
sudo mkdir -p "$home/.config/retroarch"
sudo mkdir -p "$home/.config/retroarch/configs/all"
sudo mkdir -p "$home/.config/openbox"
sudo mkdir -p "$home/.themes/Default/openbox-3"

sudo chown -R kiosk:kiosk "$home/.emulationstation"
sudo chown -R kiosk:kiosk "$home/.emu"
sudo chown -R kiosk:kiosk "$home/.config/devilspie2"
sudo chown -R kiosk:kiosk "$home/.config/retroarch"
sudo chown -R kiosk:kiosk "$home/.config/openbox"
sudo chown -R kiosk:kiosk "$home/.themes/"