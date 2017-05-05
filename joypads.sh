#!/bin/bash

auto_conf=/home/kiosk/.config/retroarch/autoconfig

sudo test ! -d "$auto_conf" && sudo -u kiosk HOME=/home/kiosk/ git clone https://github.com/libretro/retroarch-joypad-autoconfig.git $auto_conf
