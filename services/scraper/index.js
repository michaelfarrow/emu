var observer = require('inquirer/lib/utils/events')
var async = require('async')
var _ = require('lodash')
var fs = require('fs-extra')
var path = require('path')
var url = require('url')
var querystring = require('querystring')
var request = require('request')
var xml = require('xml2js')
var inquirer = require('inquirer')
var chalk = require('chalk')
var clear = require('clear')
var clui = require('clui')
var charm = require('charm')()
var alphaSort = require('alphanum-sort')
var moment = require('moment')
var sharp = require('sharp')
var elasticlunr = require('elasticlunr')
var ansiEscapes = require('ansi-escapes')

process.env.VIPS_WARNING = 0

charm.pipe(process.stdout)
charm.reset()

clear()
var loadingSpinner = new clui.Spinner('Loading')
loadingSpinner.start()

var spinnerNames = {
  loading: 'Loading',
  scraping: 'Scraping',
  fetching: 'Fetching Data'
}

var spinners = {}
_.each(spinnerNames, function(name, key) {
  spinners[key] = new clui.Spinner(name)
})

var debug = process.env.NODE_ENV === 'development'
var test = process.env.TEST_MODE === 'true'

var configFile = '/tmp/emu-scraper.json'
var config = {}
var esDir = '/home/kiosk/.emulationstation'
var gamelistDir = path.resolve(esDir, 'gamelists')
var imagesDir = path.resolve(esDir, 'downloaded_images')
var confSystems = path.resolve(esDir, 'es_systems.cfg')

var apiBase = 'http://thegamesdb.net/api/'
var imageBase = 'http://thegamesdb.net.rsz.io/banners/'
var imageBaseOriginal = 'http://thegamesdb.net/banners/'
var imageWidth = 1000

var alphaCodes = _.range(
  'a'.charCodeAt(0),
  'z'.charCodeAt(0) + 1
)

var alphas = _.map(alphaCodes, function (a) {
  return String.fromCharCode(a).toUpperCase()
})

var prepositions = ['The', 'A', 'An']

var STR = {
  status: {
    ok: chalk.green('✓'),
    error: chalk.red('✗'),
    matching: chalk.red('!'),
    missing: chalk.red('✗'),
    noImage: chalk.red('▣')
  }
}

var systems = []
var _xml = {}

var platformMap = {
  '3do': '3DO',
  'amiga': 'Amiga',
  'amstradcpc': 'Amstrad CPC',
//  'apple2': '',
  'arcade': 'Arcade',
//  'atari800': '',
  'atari2600': 'Atari 2600',
  'atari5200': 'Atari 5200',
  'atari7800': 'Atari 7800',
  'atarilynx': 'Atari Lynx',
//  'atarist': '',
  'atarijaguar': 'Atari Jaguar',
  'atarijaguarcd': 'Atari Jaguar CD',
  'atarixe': 'Atari XE',
  'colecovision': 'Colecovision',
  'c64': 'Commodore 64', // commodore 64
  'intellivision': 'Intellivision',
  'macintosh': 'Mac OS',
  'xbox': 'Microsoft Xbox',
  'xbox360': 'Microsoft Xbox 360',
//  'msx': '',
  'neogeo': 'NeoGeo',
  'ngp': 'Neo Geo Pocket', // neo geo pocket
  'ngpc': 'Neo Geo Pocket Color', // neo geo pocket color
  'n3ds': 'Nintendo 3DS', // nintendo 3DS
  'n64': 'Nintendo 64', // nintendo 64
  'nds': 'Nintendo DS', // nintendo DS
  'nes': 'Nintendo Entertainment System (NES)', // nintendo entertainment system
  'gb': 'Nintendo Game Boy', // game boy
  'gba': 'Nintendo Game Boy Advance', // game boy advance
  'gbc': 'Nintendo Game Boy Color', // game boy color
  'gc': 'Nintendo GameCube', // gamecube
  'wii': 'Nintendo Wii',
  'wiiu': 'Nintendo Wii U',
  'pc': 'PC',
  'sega32x': 'Sega 32X',
  'segacd': 'Sega CD',
  'dreamcast': 'Sega Dreamcast',
  'gamegear': 'Sega Game Gear',
  'genesis': 'Sega Genesis', // sega genesis
  'mastersystem': 'Sega Master System', // sega master system
  'megadrive': 'Sega Mega Drive', // sega megadrive
  'saturn': 'Sega Saturn', // sega saturn
  'psx': 'Sony Playstation',
  'ps2': 'Sony Playstation 2',
  'ps3': 'Sony Playstation 3',
  'ps4': 'Sony Playstation 4',
  'psvita': 'Sony Playstation Vita',
  'psp': 'Sony PSP', // playstation portable
  'snes': 'Super Nintendo (SNES)', // super nintendo entertainment system
  'pcengine': 'TurboGrafx 16', // turbografx-16/pcengine
  'wonderswan': 'WonderSwan',
  'wonderswancolor': 'WonderSwan Color',
  'zxspectrum': 'Sinclair ZX Spectrum'
}

var writeXml = function (system, callback) {
  var systemData = _xml[system.id]
  systemData = _.sortBy(systemData, 'name')
  if (!systemData) return callback(new Error('System data not found'))
  var builder = new xml.Builder()
  var built = builder.buildObject({
    gameList: {
      game: systemData
    }
  })
  fs.writeFile(system.gamelistPath, built, callback)
}

var writeQueue = async.queue(function (task, callback) {
  var sid = task.system.id
  var index = _.findIndex(_xml[sid], { path: task.data.path })
  if (index !== -1) {
    _xml[sid][index] = task.data
  } else {
    _xml[sid].push(task.data)
  }
  writeXml(task.system, callback)
}, 1)

var listenForKey = function (prompt, filter, f) {
  var events = observer(prompt.ui.rl)
  if (!events.customId) {
    events.customId = 0
  } else {
    events.customId++
  }
  var fId = 'custom_' + events.customId
  events[fId] = events.keypress.filter(function (e) { return filter(e.key) }).share()
  events[fId].takeUntil(events.line).forEach(f)
}

var keyFilters = {
  backspace: function (key) { return key.name === 'backspace' },
  escape: function (key) { return key.name === 'escape' },
  up: function (key) { return key.name === 'up' },
  down: function (key) { return key.name === 'down' },
  alpha: function(key) { return key.name && alphas.indexOf(key.name.toUpperCase()) !== -1 },
}

var getFileContents = function (path, callback) {
  fs.readFile(path, {encoding: 'utf8'}, callback)
}

var parseXml = function (data, callback) {
  xml.parseString(data, {
    explicitArray: false
  }, callback)
}

var readXmlFile = function (path, callback) {
  async.waterfall([
    async.apply(getFileContents, path),
    parseXml
  ], callback)
}

var getXmlValue = function (data, path) {
  var val = _.get(data, path)
  return val || ''
}

var getXmlValues = function (data, paths) {
  var mapped = {}
  _.each(paths, function (path) {
    var from = path
    var to = path
    if (_.isArray(path)) {
      from = path[0]
      to = path[1]
    }
    _.set(mapped, to, getXmlValue(data, from))
  })
  return mapped
}

var listDirectory = function (dir, callback) {
  fs.readdir(dir, callback)
}

var listDirectoryFilter = function (dir, filter, callback) {
  listDirectory(dir, function (err, paths) {
    if (err) return callback(err)
    async.filter(paths, function (path, callback) {
      filter(path, dir + '/' + path, callback)
    }, callback)
  })
}

var parseSystems = function (data, callback) {
  if (!_.isArray(data.systemList.system)) data.systemList.system = [data.systemList.system]
  var i = 0
  var systems = _.map(data.systemList.system, function (system) {
    var mapped = _.pick(system, ['fullname', 'platform', 'path', 'extension'])
    mapped.extension = _.without(mapped.extension.split(' '), '')
    mapped.platform = _(mapped.platform.split(','))
      .map(function (platform) {
        return platform.trim()
      })
      .filter(function (platform) {
        return platform.length > 0
      })
      .value()
    mapped.imagesDir = path.resolve(imagesDir, mapped.platform[0])
    mapped.gamelistDir = path.resolve(gamelistDir, mapped.platform[0])
    mapped.gamelistPath = path.resolve(mapped.gamelistDir, 'gamelist.xml')
    mapped.id = i
    i++
    return mapped
  })
  callback(null, systems)
}

var sendPrepositionToEnd = function(str) {
  _.each(prepositions, function(preposition) {
    if(str.toLowerCase().indexOf(preposition.toLowerCase() + ' ') === 0) {
      str = str.substring(preposition.length + 1) + ', ' + preposition
      return false
    }
  })
  return str
}

var parseRom = function(system, rom) {
  var id = rom.match(/\(tgdb_id:(\d+)\)/)
  var cleanRom = cleanRomName(path.basename(rom, path.extname(rom)))
  var existing = findExisting(system, rom)
  var name = existing ? existing.name : cleanRom
  // name = sendPrepositionToEnd(name)
  var matching = existing ? _.filter(_xml[system.id], { name: name }) : []
  var statusDisplay = STR.status.ok
  var status = 'ok'
  if (existing && !existing.image) {
    statusDisplay = STR.status.noImage
    status = 'noImage'
  }
  if (matching.length > 1) {
    statusDisplay = STR.status.matching
    status = 'matching'
    name += ' (' + cleanRom + ')'
  }
  if (!existing) {
    statusDisplay = STR.status.missing
    status = 'missing'
  }
  return {
    name: rom,
    displayName: name,
    displayNameWithStatus: statusDisplay + ' ' + name,
    status: status,
    apiId: id ? id[1] : null
  }
}

var removePrepositions = function(str) {
  _.each(prepositions, function (preposition) {
    var search = ', ' + preposition
    var i = str.toLowerCase().indexOf(search.toLowerCase())
    if (i !== -1) {
      str = str.substr(i)
    }
  })
  return str
}

var parseRoms = function (system, roms) {
  var sorted = _.map(roms, function (rom) {
    return parseRom(system, rom)
  })
  sorted.sort(function(a, b){
    var aComp = a.displayName.toLowerCase()
    var bComp = b.displayName.toLowerCase()
    //aComp = removePrepositions(aComp)
    //bComp = removePrepositions(bComp)
    return aComp.localeCompare(bComp)
  })
  return sorted
}

var getRoms = function (system, callback) {
  listDirectoryFilter(
    system.path,
    function (file, full, callback) {
      callback(null, system.extension.indexOf(path.extname(file)) !== -1)
    },
    function (err, roms) {
      if (err && err.code === 'ENOENT') return callback(null, [])
      if (err) return callback(err)
      callback(null, parseRoms(system, roms))
    }
  )
}

var apiRequest = function (type, el, params, callback) {
  var url = apiBase + type + '.php?' + querystring.stringify(params)
  if (debug) console.log(url)
  async.retry(3, function (callback) {
    request.get(
      url,
      function (err, res, body) {
        // console.log('done');
        if (err) return callback(err)
        if (res.statusCode !== 200) return callback(new Error('api error: ' + res.statusCode))
        if (!body) return callback(null, null)
        parseXml(body, function (err, parsed) {
          if (err) return callback(err)
          if (!parsed) return callback(null, null)
          callback(null, _.get(parsed, 'Data.' + el, null))
        })
      }
    )
  }, callback)
}

var validateDataArray = function (data) {
  return data && _.isArray(data) && data.length
}

var getGameDataPlatform = function (param, search, platform, callback) {
  var params = {}
  params[param] = search
  if (platform) params.platform = _.get(platformMap, platform, '')
  apiRequest('GetGame', 'Game', params, function (err, data) {
    if (err) return callback(err)
    if (data && !_.isArray(data)) data = [data]
    if (validateDataArray(data)) return callback(null, data)
    callback(null, [])
  })
}

var cleanRomName = function (name) {
  name = name.replace(/\([^)]{0,3}\)/g, '')
  name = name.replace(/\(v\d[^)]*\)/gi, '')
  name = name.replace(/\(\d*\)/g, '')
  name = name.replace(/\[[^\]]*\]/g, '')
  name = name.replace(/{[^}]*}/g, '')
  name = name.replace(/\s\s+/g, ' ')
  name = name.trim()
  return name
}

var getGameData = function (system, rom, callback) {
  if (debug) console.log('getGameData')

  if (rom.apiId) {
    return getGameDataPlatform('id', rom.apiId, null, callback)
  }

  var name = path.basename(rom.name, path.extname(rom.name))
  var move = prepositions
  _.each(move, function (toMove) {
    var search = ', ' + toMove
    var i = name.indexOf(search)
    if (i !== -1) {
      name = toMove + ' ' + name.replace(search, '')
    }
  })
  name = cleanRomName(name)

  async.concatSeries(
    system.platform,
    async.apply(getGameDataPlatform, 'exactname', name),
    function (err, exactData) {
      if (err) return callback(err)
      exactData = validateDataArray(exactData) ? exactData : []
      async.concatSeries(
        system.platform,
        async.apply(getGameDataPlatform, 'name', name),
        function (err, data) {
          if (err) return callback(err)
          data = validateDataArray(data) ? data : []
          var allData = _(exactData).concat(data).uniqBy('id').value()
          if(allData.length) return callback(null, allData)
          callback(null, null)
        }
      )
    }
  )
}

var displayGameSelectNav = function (system, data, answer, last, callback) {
  var mapped = _.map(data, function (game, i) {
    name = game.GameTitle
    if(system.platform.length > 1) name += ' (' + game.Platform + ')'
    return {
      value: i,
      name: name
    }
  })
  var questions = [
    {
      type: 'list',
      name: answer,
      message: 'Choose Game',
      choices: mapped,
      pageSize: 20
    }
  ]
  callback(null, inquirer.prompt(questions))
}

var selectGame = function (system, rom, data, callback) {
  async.waterfall([
    async.apply(parseGameData, system, rom, data),
    async.apply(downloadArt, system, rom),
    async.apply(writeGameXml, system)
  ], callback)
}

var createGameSelectNav = function (bypass, system, rom, data, callback) {
  spinners.scraping.stop()
  if (!data) return callback(null, null)
  if (bypass) return selectGame(system, rom, data[0], callback)
  createNavigation({
    header: function() {
      romInfo(system, rom)
    },
    menu: async.apply(displayGameSelectNav, system, data),
    answer: 'game',
    once: true,
    process: function (game, callback) {
      spinners.fetching.start()
      selectGame(system, rom, data[game], callback)
    }
  }, callback)
}

var parseGameData = function (system, rom, data, callback) {
  if (debug) console.log('parseGameData')
  if (!data) return callback(null, null)
  var mapped = getXmlValues(data, [
    ['GameTitle', 'name'],
    ['ReleaseDate', 'releasedate'],
    ['Overview', 'desc'],
    ['Images', 'images'],
    ['Players', 'players'],
    ['Rating', 'rating'],
    ['Publisher', 'publisher'],
    ['Developer', 'developer']
  ])
  var arts = _.get(mapped, 'images.boxart', [])
  if (arts && !_.isArray(arts)) arts = [arts]
  _.each(arts, function (art) {
    if (_.get(art, '$.side') === 'front') {
      var imagePath = _.get(art, '_', '') + '?width=' + imageWidth
//      mapped.image = imageBase + imagePath
      mapped.image = imageBaseOriginal + imagePath
      return false
    }
  })
  delete mapped.images
  mapped.path = system.path + '/' + rom.name
  if (!mapped.players || !mapped.players.length) {
    mapped.players = '1?'
  }
  if (!mapped.rating || !mapped.rating.length) {
    mapped.rating = '0'
  }
  mapped.rating = Math.round(parseFloat(mapped.rating) / 10 * 5) / 5
  if (mapped.releasedate) {
    mapped.releasedate = moment(mapped.releasedate, 'MM/DD/YYYY').format('YYYYMMDDT000000')
  }
  mapped.name = sendPrepositionToEnd(mapped.name)
  // console.log(mapped);
  // console.log('here 3');
  // console.log(callback);
  callback(null, mapped)
}

var writeGameXml = function (system, data, callback) {
  spinners.fetching.stop()
  if (!data) return callback(null)
//  if(data.imageOriginal) delete data.imageOriginal
  writeQueue.push({
    system: system,
    data: data
  }, function(err) {
    if(err) return callback(err)
    callback(null, data)
  })
}

var downloadArt = function (system, rom, data, callback) {
  if (debug) console.log('downloadArt')
  if (!data) return callback(null, null)

  if (!data.image || !data.image.length) {
    if (data.image) delete data.image
    return callback(null, data)
  }

//  var original = false

  async.retry(3, function (callback) {
    var from = data.image
    var pathname = url.parse(from).pathname
    var to = path.resolve(system.imagesDir, path.basename(rom.name, path.extname(rom.name)) + '.jpg')
    request(from, { encoding: null }, function (err, res, body) {
        // console.log(err, res.statusCode, body.length);
      if (err) return callback(err)
  /*    if (res.statusCode === 404) {
        data.image = data.imageOriginal
        original = true
        return callback(new Error('404 error'), data)
      }
  */
      if (res.statusCode !== 200) return callback(new Error('Artwork download error: ' + res.statusCode))
      var writeCallback = function (err) {
        if (err) return callback(err)
        data.image = to
        callback(null, data)
      }

   //   if (original) {
        return sharp(body).resize(imageWidth).jpeg().toFile(to, writeCallback)
   //   }
   //   fs.writeFile(to, imageData, 'binary', writeCallback)
    })
  }, function(err, data) {
    if(err) return callback(err)
    callback(null, data)
  })
}

var findExisting = function(system, rom) {
  if(_.isObject(rom)) rom = rom.name
  return _.find(_xml[system.id], { path: system.path + '/' + rom })
}

var addGameData = function (force, select, system, rom, callback) {
  var existing = findExisting(system, rom)
  if (existing && existing.image && existing.image.length && !force) return callback(null, existing)
  async.waterfall([
    async.apply(getGameData, system, rom),
    async.apply(createGameSelectNav, !select, system, rom)
  ], callback)
}

var displaySystemList = function (multi, answer, last, callback) {
  var spinner = new clui.Spinner('Loading System List')
  spinner.start()
  var mapped = []
  async.eachOf(systems, function (system, i, callback) {
    getRoms(system, function (err, roms) {
      if (err) return callback(err)
      var counts = {
        all: roms.length,
        ok: _.filter(roms, { status: 'ok' }).length,
        matching: _.filter(roms, { status: 'matching' }).length,
        missing: _.filter(roms, { status: 'missing' }).length,
        noImage: _.filter(roms, { status: 'noImage' }).length
      }
      var name = system.fullname
      name += ' (' + counts.all
      _.each(['ok', 'matching', 'missing', 'noImage'], function (status) {
        var count = counts[status]
        if (count) name += ', ' + STR.status[status] + ' ' + count
      })
      name += ')'
      mapped[i] = { name: name, value: i }
      callback(null)
    })
  }, function (err) {
    if (err) return callback(err)
    if (!last && multi) last = _.map(mapped, 'value')
    var questions = [
      {
        type: multi ? 'checkbox' : 'list',
        name: answer,
        message: multi ? 'Choose Systems' : 'Choose System',
        choices: mapped,
        default: last,
        pageSize: 20
      }
    ]
    spinner.stop()
    callback(null, inquirer.prompt(questions))
  })
}

var drawProgress = function (items, currentSystem, clear) {
  if (clear && !debug) charm.up(items.length)
  var nameWidth = _.maxBy(items, 'name.length').name.length
  _.each(items, function (item, i) {
    var total = item.total
    var current = item.progress
    var displayTotal = total
    var displayCurrent = current
    var hasTotal = true
    var success = item.success
    if (total === -1) {
      total = 100
      hasTotal = false
    } else if (total === 0) {
      total = 100
      current = 100
    }
    var progressWidth = current === 0 ? 20 : 21
    var progress = new clui.Progress(progressWidth)
    var name = item.name
    var successStr = ''
    if(hasTotal && current > 0) {
      var fail = current - success
      if(success) successStr += ' ' + STR.status.ok + ' ' + success
      if(fail) successStr += ' ' + STR.status.error + ' ' + fail
    }
    name = i === currentSystem ? chalk.yellow(name) : name
    new clui.Line()
      .padding(2)
      .column(name, nameWidth)
      .padding(2)
      .column(progress.update(current, total), 27)
      .padding(2)
      .column(hasTotal ? (displayCurrent + ' of ' + displayTotal) : '', 15)
      .column(successStr, 15)
      .fill()
      .output()
  })
}

var scrapeSystem = function (system, progress, callback) {
  getRoms(system, function (err, roms) {
    if (err) return callback(err)

    if (debug || test) roms = roms.slice(0, 25)

    progress(0, roms.length)

    var queue = async.queue(function (rom, callback) {
      addGameData(false, false, system, rom, callback)
    }, 10)

    // TODO: fix this error handling
    var done = 0
    queue.push(roms, function (err, res) {
      if (err) return
      done++
      progress(done, roms.length, res && res.image)
    })

    queue.drain = function (err) {
      // console.log('queue drain');
      callback(err)
    }
  })
}

var scrapeSystems = function (systems, callback) {
  if (!systems.length) return callback()
  /// clear()
  // var spinner = new clui.Spinner('Scraping')
//  spinner.start()
  // console.log('Scraping')

  var items = _.map(systems, function (system) {
    return {
      name: system.fullname,
      progress: 0,
      total: -1,
      success: 0,
    }
  })

  drawProgress(items, 0)

  var queue = async.queue(function (system, callback) {
    scrapeSystem(system, function (progress, total, success) {
      items[system.i].progress = progress
      items[system.i].total = total
      if(success) items[system.i].success++
      drawProgress(items, system.i, true)
    }, callback)
  }, 1)

  var queueSystems = _.map(systems, function (system, i) {
    system.i = i
    return system
  })

  queue.push(queueSystems)

  queue.drain = function (err) {
    // spinner.stop()
    // console.log('queue drain');
    callback(err)
  }
}

var displayAlphaList = function (system, answer, last, callback) {
  getRoms(system, function (err, roms) {
    if (err) return callback(err)
    var mapped = _(['#'])
      .concat(alphas)
      .map(function (letter) {
        var filteredRoms = filterRomsByLetter(roms, letter)
        if (!filteredRoms.length) return false
        var matching = _.filter(filteredRoms, { status: 'matching' })
        var missing = _.filter(filteredRoms, { status: 'missing' })
        var noImage = _.filter(filteredRoms, { status: 'noImage' })
        var name = letter
        if (matching.length || missing.length || noImage.length) {
          name += ' '
          if (missing.length) name += STR.status.missing
          if (matching.length) name += STR.status.matching
          if (noImage.length) name += STR.status.noImage
        }
        name += ' - ' + filteredRoms.length
        return {
          value: letter,
          name: name
        }
      })
      .compact()
      .value()
    var questions = [
      {
        type: 'list',
        name: answer,
        message: 'Letter',
        choices: mapped,
        default: last,
        pageSize: 27
      }
    ]
    var prompt = inquirer.prompt(questions)
    listenForKey(
        prompt,
        keyFilters.alpha,
        function (e) {
          var question = _.findIndex(mapped, { value: e.key.name.toUpperCase() })
          if (question !== -1) {
            prompt.ui.activePrompt.selected = question
            prompt.ui.activePrompt.render()
          }
        }
      )
    callback(null, prompt)
  })
}

var filterRomsByLetter = function (roms, letter) {
  var pattern
  if (letter === '#') {
    pattern = new RegExp('^[^a-z]', 'i')
  } else {
    pattern = new RegExp('^' + letter, 'i')
  }
  return _.filter(roms, function (rom) {
    return rom.displayName.match(pattern)
  })
}

var displayGameOptionsNav = function (answer, last, callback) {
  var questions = [
    {
      type: 'list',
      name: answer,
      message: 'Action',
      choices: [
        { name: 'Scrape', value: 'scrape' },
        { name: 'Rename', value: 'edit' },
        { name: 'Clear', value: 'clear' },
        { name: 'Delete', value: 'delete' }
      ]
    }
  ]
  callback(null, inquirer.prompt(questions))
}

var displayEditRom = function(system, rom, answer, last, callback) {
  var questions = [
    {
      type: 'input',
      name: answer,
      message: chalk.cyan('Rename:'),
    }
  ]
  var prompt = inquirer.prompt(questions)
  prompt.ui.rl.write(path.basename(rom.name, path.extname(rom.name)))
  prompt.ui.activePrompt.render()
  callback(null, prompt)
}

var renameRom = function(system, rom, name, callback) {
  var fromFile = rom.name
  var from = system.path + '/' + fromFile
  var toFile = name.replace('/', '') + path.extname(fromFile)
  var to = system.path + '/' + toFile
  if(from === to) return callback()
  // console.log('Renaming', from, 'to', to)
  fs.pathExists(to, function (err, exists) {
    if(err) return callback(err)
    if(exists) return callback(new Error('Destination file exists, cannot overwrite'))
    fs.move(from, to, function(err) {
      if(err) return callback(err)
      var existing = findExisting(system, rom)
      var finish = function() {
        var newRom = parseRom(system, toFile)
        _.each(_.keys(newRom), function(key) {
          rom[key] = newRom[key]
        })
        writeXml(system, callback)
      }
      if(existing) {
        existing.path = to
        if(existing.image && existing.image.length) {
          var imgFrom = existing.image
          var imgTo = path.resolve(path.dirname(imgFrom), path.basename(toFile, path.extname(toFile)) + path.extname(imgFrom))
          fs.move(imgFrom, imgTo, function(err) {
            if(err) return callback(err)
            existing.image = imgTo
            finish()
          })
        } else {
          finish()
        }
      } else {
        finish()
      }
    });
  })
}

var infoList = function(data, width) {
  headingWidth = width || _.maxBy(_.keys(data), 'length').length
  _.each(data, function(val, heading) {
    console.log(chalk[heading.toLowerCase().trim() === 'error' ? 'red' : 'yellow'](heading + ':') + Array(headingWidth - heading.length + 2).join(' '), val)
  });
}

var systemInfo = function(system) {
  infoList({
    System: system.fullname
  }, 9)
}

var romInfo = function(system, rom) {
  systemInfo(system)
  console.log('')
  var existing = findExisting(system, rom)
  var info = {
    ROM: rom.name
  }
  if(existing) {
    if(existing.name) info.Name = existing.name
    if(existing.rating) info.Rating = existing.rating
    if(existing.players) info.Players = existing.players
    if(existing.developer) info.Developer = existing.developer
    if(existing.publisher) info.Publisher = existing.publisher
    info.Image = existing.image && existing.image.length ? (STR.status.ok + ' ' + path.basename(existing.image)) : STR.status.error
    var matching = _.filter(_xml[system.id], { name: existing.name })
    var matchingDiff = matching.length - 1
    if(matchingDiff > 0) info.Error = 'There ' + (matchingDiff === 1 ? 'is' : 'are') + ' ' + matchingDiff + ' other game' + (matchingDiff > 1 ? 's' : '') + ' with the same name'
  }
  infoList(info, 9)
}

var displayConfirm = function(answer, last, callback) {
  callback(null, inquirer.prompt({
    name: answer,
    type: 'confirm',
    message: 'Are you sure?'
  }))
}

var clearRom = function(system, rom, confirm, callback) {
  if(!confirm) return callback()
  var index = _.findIndex(_xml[system.id], { path: system.path + '/' + rom.name })
  if(index === -1) return callback()
  _xml[system.id].splice(index, 1)
  writeXml(system, callback)
}

var deleteRom = function(system, rom, confirm, callback) {
  if(!confirm) return callback()
  var existing = findExisting(system, rom)
  var jobs = []
  jobs.push(async.apply(fs.remove, system.path + '/' + rom.name))
  if(existing) {
    if(existing.image && existing.image.length) {
      jobs.push(function(callback) {
        fs.remove(existing.image, function() {
          callback(null)
        })
      })
    }
    jobs.push(async.apply(clearRom, system, rom, true))
  }
  async.series(jobs, function(err) {
    if (err) return callback(err)
    callback(null, { menu: { exit: 2 } })
  })
}

var createGameOptionsNav = function(system, rom, callback) {
  createNavigation({
    header: function() {
      romInfo(system, rom)
    },
    menu: displayGameOptionsNav,
    answer: 'action',
    process: {
      scrape: function(callback) {
        scrapeRom(system, rom, callback)
      },
      edit: {
        header: function() {
          romInfo(system, rom)
        },
        once: true,
        menu: async.apply(displayEditRom, system, rom),
        answer: 'name',
        process: async.apply(renameRom, system, rom)
      },
      clear: {
        header: function() {
          romInfo(system, rom)
        },
        once: true,
        menu: displayConfirm,
        answer: 'confirm',
        process: async.apply(clearRom, system, rom)
      },
      delete: {
        header: function() {
          romInfo(system, rom)
        },
        once: true,
        menu: displayConfirm,
        answer: 'confirm',
        process: async.apply(deleteRom, system, rom)
      }
    }
  }, callback)
}

var displayRomList = function (system, filter, answer, last, callback) {
  async.waterfall([
    async.apply(getRoms, system),
    filter,
    function (roms, callback) {
      var romsQuestions = _.map(roms, function (rom, i) {
        return {
          name: rom.displayNameWithStatus,
          value: i
        }
      })
      if (last !== undefined && last > romsQuestions.length - 1) {
        last = romsQuestions.length - 1
      }
      var questions = [
        {
          type: 'list',
          name: answer,
          message: 'ROM',
          choices: romsQuestions,
          default: last,
          pageSize: 20
        }
      ]
      var prompt = inquirer.prompt(questions)
      prompt.then(function (answers) {
        return new Promise(function (resolve, reject) {
          var i = answers[answer]
          answers[answer] = {
            value: i,
            processed: roms[i]
          }
          resolve(answers)
        })
      })
      callback(null, prompt)
    }
  ], callback)
}

var displayFilteredRomListNav = function (system, letter, answer, last, callback) {
  displayRomList(system, function(roms, callback) {
    callback(null, filterRomsByLetter(roms, letter))
  }, answer, last, callback)
}

var createFilteredRomListNav = function (system, letter, callback) {
  createNavigation({
    header: function() {
      systemInfo(system)
    },
    menu: async.apply(displayFilteredRomListNav, system, letter),
    answer: 'rom',
    process: async.apply(createGameOptionsNav, system)
  }, callback)
}

var scrapeRom = function (system, rom, callback) {
  spinners.scraping.start()
  addGameData(true, true, system, rom, callback)
}

var showMenu = function (answer, last, callback) {
  var questions = [
    {
      type: 'list',
      name: answer,
      message: 'Action',
      choices: [
        { name: 'Scrape All', value: 'all' },
        { name: 'Scrape Individual', value: 'individual' }
      ].reverse(),
      default: last
    }
  ]

  callback(null, inquirer.prompt(questions))
}

var loadSystemsConfig = function (callback) {
  async.waterfall([
    async.apply(readXmlFile, confSystems),
    parseSystems
  ], function (err, data) {
    if (err) return callback(err)
    systems = data
    callback(null)
  })
}

var ensureFileSystem = function (callback) {
  var dirs = _(systems)
    .map(function (system) {
      return [system.gamelistDir, system.imagesDir]
    })
    .flatten()
    .value()

  async.each(dirs, function (dir, callback) {
    fs.ensureDir(dir, callback)
  }, callback)
}

var loadGameLists = function (callback) {
  async.each(systems, function (system, callback) {
    readXmlFile(system.gamelistPath, function (err, data) {
      if (err && err.code !== 'ENOENT') return callback(err)
      var games = _.get(data, 'gameList.game')
      if (!games) games = []
      if (!_.isArray(games)) games = [games]
      _xml[system.id] = games
      callback(null)
    })
  }, callback)
}

var catchError = function(callback) {
  return function(err, res) {
    if (!err) return callback(null, res)
    console.log('')
    console.log(chalk.styles.bgRed.open)
    console.log(err)
    console.log(chalk.styles.bgRed.close)
    setTimeout(function() {
      callback()
    }, 2500)
  }
}

var createNavigation = function (config, callback) {
  var active = true
  var lastAnswer
  async.whilst(function () { return active }, function (callback) {
    // TODO: handle 0 length lists
    clear()
    console.log('')
    var header = config.header
    if (header) {
      if (_.isFunction(header)) {
        header()
      } else {
        console.log(header)
      }
      console.log('')
    }
    if (config.once) active = false
    var cont = function (prompt) {
      var ignore = false
      listenForKey(
        prompt,
        ['input'].indexOf(prompt.ui.activePrompt.opt.type) === -1 ? keyFilters.backspace : keyFilters.escape,
        function () {
          ignore = true
          active = false
          prompt.ui.rl.input.emit('keypress', null, {name: 'enter'})
        }
      )
      prompt.then(function (answers) {
        var cb = catchError(function(err, res) {
          if (err) return callback(err)
          if (_.get(res, 'menu.exit')) {
            var willExit = false
            if (_.isNumber(res.menu.exit)) {
              if(res.menu.exit !== 0) willExit = true
              res.menu.exit--
            } else if (res.menu.exit === true) {
              willExit = true
              res.menu.exit = false
            }
            if (willExit) {
              active = false
            }
          }
          callback(null, res)
        })
        if (ignore) return cb(null)
        var answer = answers[config.answer]
        if (_.isObject(answer) && answer.value !== undefined && answer.processed !== undefined) {
          lastAnswer = answer.value
          answer = answer.processed
        } else {
          lastAnswer = answer
        }
        var process = config.process
        if (_.isFunction(process)) {
          var pa = config.processAnswer
          if (!pa) return process(answer, cb)
          return pa(answer, function (err, answer) {
            if (err) return cb(err)
            process(answer, cb)
          })
        }
        var p = _.get(process, answer)
        if (!p) return cb(new Error('Unhandled menu answer: ' + answer))
        if (_.isFunction(p)) {
          return p(cb)
        }
        createNavigation(p, cb)
      })
    }
    config.menu(config.answer, lastAnswer, function (err, prompt) {
      if (err) return callback(err)
      cont(prompt)
    })
    // if (prompt) cont(prompt)
  }, callback)
}

var displayIndividualScrapeNav = function (answer, last, callback) {
  var questions = [
    {
      type: 'list',
      name: answer,
      message: 'Action',
      choices: [
        { name: 'Search', value: 'search' },
        { name: 'By Letter', value: 'alpha' }
      ],
      default: last
    }
  ]
  callback(null, inquirer.prompt(questions))
}

var displaySearch = function(answer, last, callback) {
  var questions = [
    {
      type: 'input',
      name: answer,
      message: chalk.cyan('Search:'),
    }
  ]
  var prompt = inquirer.prompt(questions)
  var history = getConfigHistory('search')
  var currentHistory = -1
  var searchStr
  if (history.length) {
    prompt.ui.rl.write(history[0])
    prompt.ui.activePrompt.render()
    currentHistory = 0
  }
  var updateHistory = function(dir) {
    var to = currentHistory + dir
    if (searchStr && to === -1) {
      currentHistory = to
      prompt.ui.rl.line = searchStr
      prompt.ui.activePrompt.render()
    } else if (to < history.length && to >= 0) {
      currentHistory = to
      prompt.ui.rl.line = history[to]
      prompt.ui.activePrompt.render()
    }
  }

  listenForKey(
    prompt,
    keyFilters.up,
    function () {
      updateHistory(1)
    }
  )
  listenForKey(
    prompt,
    keyFilters.down,
    function () {
      updateHistory(-1)
    }
  )
  listenForKey(
    prompt,
    function(key) {
      return !keyFilters.up(key) && !keyFilters.down(key)
    },
    function () {
      var line = prompt.ui.rl.line
      if (history.length && history[0] && history[0] === line) {
        currentHistory = 0
        searchStr = null
      } else {
        currentHistory = -1
        searchStr = line
      }
    }
  )
  callback(null, prompt)
}

var displaySearchResultsNav = function (system, q, answer, last, callback) {
  displayRomList(system, function(roms, callback) {
    var index = elasticlunr(function () {
      this.addField('name');
      this.setRef('index');
    });
    _.each(roms, function(rom, i) {
      index.addDoc({
        name: rom.displayName,
        index: i
      })
    })
    var res = index.search(q, {})
    var resMapped = _.map(res, function(doc) {
      return roms[doc.ref]
    })
    if(!resMapped.length) return callback('No Results for "' + q + '"')
    callback(null, resMapped)
  }, answer, last, callback)
}

var doSearch = function(system, q, callback) {
  q = q ? q.trim() : ''
  pushConfigHistory('search', q)
  createNavigation({
    header: function() {
      systemInfo(system)
      console.log('')
      infoList({
        Query: q
      }, 9)
    },
    menu: async.apply(displaySearchResultsNav, system, q),
    answer: 'rom',
    process: async.apply(createGameOptionsNav, system)
  }, function(err) {
    if (err) return callback(err)
    callback(null, { menu: { exit: 1 } })
  })
}

var createIndividualScrapeNav = function (system, callback) {
  createNavigation({
    header: function() {
      systemInfo(system)
    },
    menu: displayIndividualScrapeNav,
    answer: 'action',
    process: {
      search: {
        header: function() {
          systemInfo(system)
        },
        menu: displaySearch,
        answer: 'q',
        process: async.apply(doSearch, system)
      },
      alpha: {
        header: function() {
          systemInfo(system)
        },
        menu: async.apply(displayAlphaList, system),
        answer: 'letter',
        process: async.apply(createFilteredRomListNav, system)
      }
    }
  }, callback)
}

var getSystem = function (id, callback) {
  var system
  if (_.isArray(id)) {
    system = _.filter(systems, function (system) {
      return id.indexOf(system.id) !== -1
    })
  } else {
    system = _.find(systems, {id: id})
  }
  if (callback) return callback(null, system)
  return system
}

var deleteMissingGames = function (system, callback) {
  var toDelete = []
  var i = -1
  var queue = async.queue(function (game, callback) {
    fs.pathExists(game.path, function (err, exists) {
      if (err) return callback(err)
      i++
      if (exists) return callback()
      toDelete.push(i)
      callback()
    })
  }, 1)
  queue.push(_xml[system.id])
  queue.error = function (err) {
    queue.kill()
    callback(err)
  }
  queue.drain = function () {
    if (!toDelete.length) return callback()
    _.each(toDelete.reverse(), function (i) {
      _xml[system.id].splice(i, 1)
    })
    writeXml(system, callback)
  }
}

var deleteMissingListGames = function (callback) {
  async.eachSeries(systems, deleteMissingGames, callback)
}

var deleteOrphanArtwork = function (callback) {
  async.eachSeries(systems, function(system, callback) {
    listDirectoryFilter(system.imagesDir, function(file, full, callback) {
      fs.stat(full, function(err, info) {
        if (err) return callback(err)
        var found = _.find(_xml[system.id], { image: full })
        callback(null, info.isFile() && !found)
      })
    }, function(err, images) {
      if (err) return callback(err)
      async.eachSeries(images, function(image, callback) {
        fs.remove(path.resolve(system.imagesDir, image), callback)
      }, callback)
    })
  }, callback)
}

var configWriteQueue = async.queue(function (data, callback) {
  fs.writeFile(configFile, JSON.stringify(data), callback)
}, 1)

var loadConfig = function (callback) {
  fs.pathExists(configFile, function(err, exists) {
    if (err) return callback(err)
    if (!exists) return callback()
    fs.readFile(configFile, 'utf8', function (err, data) {
      if (err) return callback(err)
      config = JSON.parse(data);
      callback()
    });
  })
}

var saveConfig = function (callback) {
  configWriteQueue.push(_.cloneDeep(config), callback)
}

var pushConfigHistory = function (path, str, callback) {
  var history = getConfigHistory(path)
  if (history.length && history[0] === str) return callback ? callback() : false
  history.unshift(str)
  history = _.take(history, process.env.CONFIG_HISTORY_LENGTH || 100)
  _.set(config, 'history.' + path, history)
  saveConfig(callback)
}

var getConfigHistory = function(path) {
  return _.get(config, 'history.' + path, [])
}

var getConfigHistoryLast = function(path) {
  var history = getConfigHistory(path)
  return history.length ? history[0] : null
}

async.series([
  loadConfig,
  loadSystemsConfig,
  ensureFileSystem,
  loadGameLists,
  deleteMissingListGames,
  deleteOrphanArtwork,
  function(callback) {
    loadingSpinner.stop()
    callback()
  },
  async.apply(createNavigation, {
    menu: showMenu,
    answer: 'action',
    clearOnReturn: false,
    process: {
      all: {
        menu: async.apply(displaySystemList, true),
        once: true,
        answer: 'system',
        processAnswer: getSystem,
        process: scrapeSystems
      },
      individual: {
        menu: async.apply(displaySystemList, false),
        answer: 'system',
        processAnswer: getSystem,
        process: createIndividualScrapeNav
      }
    }
  })
], function (err) {
  if (err) console.log(err)
})
