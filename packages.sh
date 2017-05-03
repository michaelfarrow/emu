#!/bin/bash

sudo apt-add-repository -y ppa:emulationstation/ppa
sudo apt-add-repository -y ppa:libretro/stable

sudo apt-get update

sudo apt-get install -y ubuntu-drivers-common
sudo apt-get install -y emulationstation vorbis-tools
sudo apt-get install -y libretro-nestopia libretro-snes9x-next libretro-mupen64plus libretro-mednafen-psx libretro-gambatte libretro-picodrive libretro-prosystem libretro-stella

sudo apt-get install -y --no-install-recommends xorg openbox pulseaudio compton
sudo apt-get install -y plymouth plymouth-dbg plymouth-theme-ubuntu-logo
sudo apt-get install -y upstart-sysv xserver-xorg-legacy devilspie2

sudo apt-get install -y bluetooth rfkill wminput xwiimote
