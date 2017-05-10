var async = require('async');
var _ = require('lodash');
var fs = require('fs');
var xml = require('xml2js');

//var data = fs.readFileSync('/home/kiosk/.emulationstation/gamelists/nes/gamelist.xml', {encoding:'utf8'});

var systems = ['nes'];

//xml.parseString(data, function (err, result) {
//	_.each(result.gameList.game, function(game){
//		console.log(game.play);
//	});
//});

var exists = function(path, callback) {
	fs.stat(path, function(err, stat) {
		if (err === null) {
			callback(null, true);
		} else if (err.code == 'ENOENT') {
			callback(null, false);
		} else {
			callback(err);
		}
	});
}

var ifDoesntExist = function(path, f, callback) {
	exists(path, function(err, doesExist) {
		if(err) return callback(err);
		var newCallback = function(err) {
			callback(err, !doesExist);
		};
		if(!doesExist) return f(newCallback);
		newCallback(null);
	});
};

var path = function(system, append) {
	append = append || '';
	return '/home/kiosk/.emulationstation/gamelists/' + system + '/gamelist' + append + '.xml';
};

var backupList = function(system, callback) {
	var source = path(system)
	var target = path(system, '.backup');
	console.log(source);
	console.log(target);
	ifDoesntExist(
		target,
		function(callback) {
			var rd = fs.createReadStream(source);
			rd.on('error', callback);
			var wr = fs.createWriteStream(target);
			wr.on('error', callback);
			wr.on('close', function(ex) {
				callback(null)
			});
			rd.pipe(wr);
		},
		callback
	);
};

var getXml = function(system, callback) {
	fs.readFile(path(system), {encoding: 'utf8'}, callback);
};

var parseXml = function(data, callback) {
	xml.parseString(data, callback);
};

var checkData = function(data, callback) {
	data.gameList.game = _.map(data.gameList.game, function(game) {
		if(!game.players || (_.isArray(game.players) && !game.players[0])) {
			game.players = ['1?'];
		}
		if(!game.rating || (_.isArray(game.rating) && !game.rating[0])) {
			game.rating = ['0'];
		}
		game.rating = [ Math.round(parseFloat(game.rating[0]) * 5) / 5 ];
		return game;
	});
	callback(null, data);
};

var check = function(system, callback) {
	async.waterfall([
		async.apply(getXml, system),
		parseXml,
		checkData,
		async.apply(writeList, system)
	], callback);
};

var writeList = function(system, data, callback) {
	var builder = new xml.Builder();
	var built = builder.buildObject(data);
	fs.writeFile(path(system), built, callback);
};

var processSystem = function(system, callback) {
	async.series([
		async.apply(backupList, system),
		async.apply(check, system)
	], callback)
};

async.eachSeries(systems, processSystem, function(err) {
	if(err) return console.log(err);
	console.log('done');
});

