#!/bin/bash

sudo apt-add-repository -y ppa:emulationstation/ppa
sudo apt-add-repository -y ppa:libretro/stable

sudo apt-get update

sudo apt-get install -y ubuntu-drivers-common
sudo apt-get install -y emulationstation vorbis-tools
sudo apt-get install -y libretro-nestopia libretro-snes9x-next libretro-mupen64plus libretro-mednafen-psx libretro-gambatte libretro-mgba libretro-picodrive libretro-prosystem libretro-stella

sudo apt-get install -y --no-install-recommends xorg openbox pulseaudio compton
sudo apt-get install -y plymouth plymouth-dbg plymouth-theme-ubuntu-logo
sudo apt-get install -y upstart-sysv xserver-xorg-legacy devilspie2

sudo apt-get install -y bluetooth rfkill wminput xwiimote

go_fn='go1.7.4.linux-amd64.tar.gz'

[ ! -d /usr/local/go ] && wget -P /tmp https://storage.googleapis.com/golang/$go_fn && sudo tar -C /tmp -xvf /tmp/$go_fn && sudo mv /tmp/go /usr/local
