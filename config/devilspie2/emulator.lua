function round(num, numDecimalPlaces)
 	local mult = 10^(numDecimalPlaces or 0)
 	return math.floor(num * mult + 0.5) / mult
end

if (get_window_name()~="EmulationStation") then
	debug_print("Emulator Started");
	os.execute("sleep 0.5");
	local max = 65536;
	local duration = 1;
	local fps = 15;
	for i=0,duration*fps,1 do
		-- debug_print("frame " .. tonumber(i));
		os.execute("sleep " .. tonumber(1/fps));
		os.execute("pacmd set-sink-volume 0 " .. round( tonumber( ( i / ( duration * fps ) ) * max ), 0 ) );
	end
end
