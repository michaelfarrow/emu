#!/bin/bash

sudo adduser kiosk
sudo usermod -a -G audio kiosk
sudo usermod -a -G video kiosk
sudo usermod -a -G input kiosk
