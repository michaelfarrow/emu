#!/bin/bash

WIIMOTES="/home/kiosk/.emu/config/wiimotes"
CCONFIG="/home/kiosk/.config/retroarch/configs/all/retroarch.cfg"
PLAYER=0

echo -n "" > "$CCONFIG"
if [ -f "$WIIMOTES" ]
then
	while IFS='' read -r mac || [[ -n "$mac" ]]; do
		if [ -n "$mac" ]
		then
			JOYPAD=$PLAYER
			PLAYER=$((PLAYER+1))
			cat <<- EOF >> "$CCONFIG"
				# PLAYER ${PLAYER}
				input_player${PLAYER}_joypad_index = "$JOYPAD"
				input_player${PLAYER}_a_btn = "3"
				input_player${PLAYER}_b_btn = "2"
				input_player${PLAYER}_x_btn = "10"
				input_player${PLAYER}_y_btn = "11"
				input_player${PLAYER}_l_btn = "12"
				input_player${PLAYER}_r_btn = "13"
				input_player${PLAYER}_l2_btn = "14"
				input_player${PLAYER}_r2_btn = "14"
				input_player${PLAYER}_select_btn = "5"
				input_player${PLAYER}_start_btn = "4"
				input_player${PLAYER}_up_axis = "+1"
				input_player${PLAYER}_down_axis = "-1"
				input_player${PLAYER}_left_axis = "-0"
				input_player${PLAYER}_right_axis = "+0"
				input_player${PLAYER}_l_x_plus_axis = "+2"
				input_player${PLAYER}_l_x_minus_axis = "-2"
				input_player${PLAYER}_l_y_plus_axis = "-3"
				input_player${PLAYER}_l_y_minus_axis = "+3"
				input_player${PLAYER}_r_x_plus_axis = "+4"
				input_player${PLAYER}_r_x_minus_axis = "-4"
				input_player${PLAYER}_r_y_plus_axis = "-5"
				input_player${PLAYER}_r_y_minus_axis = "+5"
			EOF
		fi
	done < "$WIIMOTES"
fi

cat <<- EOF >> "$CCONFIG"
	savestate_auto_save = true
	savestate_auto_load = true
	input_enable_hotkey_btn = "1"
	input_exit_emulator_btn = "3"
	#input_menu_toggle_btn = "10"
EOF

$1 -L /usr/lib/libretro/$2.so --appendconfig "$CCONFIG" "$3"
