#!/bin/bash

home="/home/kiosk"

cat <<- EOF | sudo tee /etc/X11/Xwrapper.config
	allowed_users=anybody
	needs_root_rights=yes
EOF

sudo sed -i -e 's/GRUB_CMDLINE_LINUX_DEFAULT=""/GRUB_CMDLINE_LINUX_DEFAULT="quiet splash loglevel=0"/g' /etc/default/grub
sudo sed -i -e 's/GRUB_CMDLINE_LINUX=""/GRUB_CMDLINE_LINUX="console=tty12"/g' /etc/default/grub
sudo sed -i -e 's/X -nolisten/X -nocursor -nolisten/g' /etc/X11/xinit/xserverrc

openbox_autostart="$home/.config/openbox/autostart"

sudo update-grub
