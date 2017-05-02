if (get_window_name()=="EmulationStation") then
	debug_print("EmulationStation Started");
	os.execute("pacmd set-sink-volume 0 0");
end
