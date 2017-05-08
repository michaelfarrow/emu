#!/bin/bash

scriptdir="$(dirname "$0")"
scriptdir="$(cd "$scriptdir" && pwd)"
home="/home/kiosk"

sudo cp "$scriptdir/config/es_systems.cfg" "$home/.emulationstation/es_systems.cfg"
sudo cp "$scriptdir/config/es_settings.cfg" "$home/.emulationstation/es_settings.cfg"
sudo cp "$scriptdir/config/retroarch.cfg" "$home/.config/retroarch/retroarch.cfg"
sudo cp "$scriptdir/config/retroarch-core-options.cfg" "$home/.config/retroarch/retroarch-core-options.cfg"
sudo cp "$scriptdir/config/rc.xml" "$home/.config/openbox/rc.xml"
sudo cp "$scriptdir/config/autostart" "$home/.config/openbox/autostart"
sudo cp "$scriptdir/config/themerc" "$home/.themes/Default/openbox-3/themerc"
sudo cp $scriptdir/config/*.conf "$home/.emu/config/"
sudo cp $scriptdir/config/devilspie2/*.lua "$home/.config/devilspie2/"
sudo cp $scriptdir/config/cores/*.cfg "$home/.config/retroarch/configs/cores/"

dp2conf="$home/.config/devilspie2/devilspie2.lua"
echo -n "scripts_window_close = {" | sudo tee "$dp2conf"
shopt -s nullglob
dp2line=0
for close in $scriptdir/config/devilspie2/*_close.lua
do
	[ $dp2line -ne 0 ] && echo -n "," | sudo tee -a "$dp2conf"
	echo -ne "\n  \"$(basename "$close")\"" | sudo tee -a "$dp2conf"
	dp2line=$((dp2line+1))
done
echo -ne "\n};\n" | sudo tee -a "$dp2conf"

sudo chown kiosk:kiosk "$home/.emulationstation/es_systems.cfg"
sudo chown kiosk:kiosk "$home/.emulationstation/es_settings.cfg"
sudo chown kiosk:kiosk "$home/.config/retroarch/retroarch.cfg"
sudo chown kiosk:kiosk "$home/.config/retroarch/retroarch-core-options.cfg"
sudo chown -R kiosk:kiosk "$home/.config/openbox/"
sudo chown -R kiosk:kiosk "$home/.config/devilspie2/"
sudo chown -R kiosk:kiosk "$home/.emu/config/"
sudo chown -R kiosk:kiosk "$home/.config/retroarch/configs/cores/"
sudo chown kiosk:kiosk "$home/.themes/Default/openbox-3/themerc"

