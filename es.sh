#!/bin/bash

es_dir="/home/kiosk/es"
suk="sudo -u kiosk HOME=/home/kiosk/"

if sudo test ! -d "$es_dir"
then
	$suk git clone https://github.com/Aloshi/EmulationStation.git $es_dir
else
	$suk bash -c "cd $es_dir && git pull origin master"
fi

$suk bash -c "cd $es_dir && cmake . && make"
sudo bash -c "cd $es_dir && make install"
