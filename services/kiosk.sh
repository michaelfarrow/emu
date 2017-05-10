#!/bin/bash

xset -dpms
xset s off

openbox-session &
devilspie2 > /home/kiosk/.emu/devilspie2.log &

sleep 1

start-pulseaudio-x11

/usr/local/bin/emulationstation --windowed --vsync 1
#--no-exit
