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

charm.pipe(process.stdout)
charm.reset()

var debug = process.env.NODE_ENV === 'development'
var test = process.env.TEST_MODE === 'true'

var esDir = '/home/kiosk/.emulationstation'
var gamelistDir = path.resolve(esDir, 'gamelists')
var imagesDir = path.resolve(esDir, 'downloaded_images')
var confSystems = path.resolve(esDir, 'es_systems.cfg')

var apiBase = 'http://thegamesdb.net/api/'
var imageBase = 'http://thegamesdb.net.rsz.io/banners/_gameviewcache/'
var imageWidth = 1000

var alphaCodes = _.range(
  'a'.charCodeAt(0),
  'z'.charCodeAt(0) + 1
)

var alphas = _.map(alphaCodes, function (a) {
  return String.fromCharCode(a).toUpperCase()
})

var STR = {
  status: {
    ok: chalk.green('✓'),
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
  backspace: function (key) { return key.name === 'backspace' }
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

var parseRoms = function (system, roms) {
  return _.map(roms, function (rom) {
    var id = rom.match(/\(tgdb_id:(\d+)\)/)
    var cleanRom = cleanRomName(path.basename(rom, path.extname(rom)))
    var existing = _.find(_xml[system.id], { path: system.path + '/' + rom })
    var name = existing ? existing.name : cleanRom
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
  })
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
      roms = alphaSort(roms)
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
  name = name.replace(/\([^)]*\)/g, '')
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
  var move = ['The', 'A', 'An']
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
    function (err, data) {
      if (err) return callback(err)
      async.concatSeries(
        system.platform,
        async.apply(getGameDataPlatform, 'name', name),
        function (err, data) {
          if (err) return callback(err)
          if (validateDataArray(data)) return callback(null, data)
          callback(null, null)
        }
      )
    }
  )
}

var displayGameSelectNav = function (data, answer, last) {
  var mapped = _.map(data, function (game, i) {
    return {
      value: i,
      name: game.GameTitle
    }
  })
  var questions = [
    {
      type: 'list',
      name: answer,
      message: 'Choose Game',
      choices: mapped
    }
  ]
  return inquirer.prompt(questions)
}

var selectGame = function (system, rom, data, callback) {
  async.waterfall([
    async.apply(parseGameData, system, rom, data),
    async.apply(downloadArt, system, rom),
    async.apply(writeGameXml, system)
  ], callback)
}

var createGameSelectNav = function (bypass, system, rom, data, callback) {
  if (!data) return callback(null, null)
  if (bypass) return selectGame(system, rom, data[0], callback)
  createNavigation({
    menu: async.apply(displayGameSelectNav, data),
    answer: 'game',
    once: true,
    header: '  ' + chalk.yellow(rom.name),
    process: function (game, callback) {
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
      mapped.image = imageBase + _.get(art, '_', '') + '?width=' + imageWidth
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
  // console.log(mapped);
  // console.log('here 3');
  // console.log(callback);
  callback(null, mapped)
}

var writeGameXml = function (system, data, callback) {
  if (debug) console.log('writeGameXml')
  // console.log(system);
  // console.log(data);
  // console.log(callback);
  if (!data) return callback(null)
  writeQueue.push({
    system: system,
    data: data
  }, callback)
}

var downloadArt = function (system, rom, data, callback) {
  if (debug) console.log('downloadArt')
  if (!data) return callback(null, null)

  if (!data.image || !data.image.length) {
    if (data.image) delete data.image
    return callback(null, data)
  }

  var from = data.image
  var pathname = url.parse(from).pathname
  var to = path.resolve(system.imagesDir, path.basename(rom.name, path.extname(rom.name)) + '-image' + path.extname(pathname))

  async.retry(3, function (callback) {
    request(from, { encoding: null }, function (err, res, body) {
        // console.log(err, res.statusCode, body.length);
      if (err) return callback(err)
      if (res.statusCode === 404) {
        delete data.image
        return callback(null, data)
      }
      if (res.statusCode !== 200) return callback(new Error('Artwork download error: ' + res.statusCode))
      if (debug) console.log('writing file')
      fs.writeFile(to, body, 'binary', function (err) {
        if (debug) console.log('writeFile')
        if (err) return callback(err)
        data.image = to
        if (debug) console.log(data)
        callback(null, data)
      })
    })
  }, callback)
}

var addGameData = function (force, select, system, rom, callback) {
  var existing = _.find(_xml[system.id], { path: system.path + '/' + rom.name })
  if (existing && !force) return callback(null)
  async.waterfall([
    async.apply(getGameData, system, rom),
    async.apply(createGameSelectNav, !select, system, rom)
  ], callback)
}

var displaySystemList = function (multi, answer, last, callback) {
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
        default: last
      }
    ]
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
    name = i === currentSystem ? chalk.yellow(name) : name
    new clui.Line()
      .padding(2)
      .column(name, nameWidth)
      .padding(2)
      .column(progress.update(current, total), 27)
      .padding(2)
      .column(hasTotal ? (displayCurrent + ' of ' + displayTotal) : '', 30)
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

    var done = 0
    queue.push(roms, function (err) {
      if (err) return
      done++
      progress(done, roms.length)
    })

    queue.drain = function (err) {
      // console.log('queue drain');
      callback(err)
    }
  })
}

var scrapeSystems = function (systems, callback) {
  clear()
  // var spinner = new clui.Spinner('Scraping')
//  spinner.start()
  // console.log('Scraping')

  var items = _.map(systems, function (system) {
    return {
      name: system.fullname,
      progress: 0,
      total: -1
    }
  })

  drawProgress(items, 0)

  var queue = async.queue(function (system, callback) {
    scrapeSystem(system, function (progress, total) {
      items[system.i].progress = progress
      items[system.i].total = total
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
        default: last
      }
    ]
    callback(null, inquirer.prompt(questions))
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

var displayFilteredRomListNav = function (system, letter, answer, last, callback) {
  getRoms(system, function (err, roms) {
    if (err) return callback(err)
    var romsFiltered = filterRomsByLetter(roms, letter)
    var romsQuestions = _.map(romsFiltered, function (rom, i) {
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
        default: last
      }
    ]
    var prompt = inquirer.prompt(questions)
    prompt.then(function (answers) {
      return new Promise(function (resolve, reject) {
        var i = answers[answer]
        answers[answer] = {
          value: i,
          processed: romsFiltered[i]
        }
        resolve(answers)
      })
    })
    callback(null, prompt)
  })
}

var createFilteredRomListNav = function (system, letter, callback) {
  createNavigation({
    menu: async.apply(displayFilteredRomListNav, system, letter),
    answer: 'rom',
    process: async.apply(scrapeRom, system)
  }, callback)
}

var scrapeRom = function (system, rom, callback) {
  // var spinner = new clui.Spinner('Scraping: ' + system.fullname + ' - ' + rom.displayName)
  // spinner.start()
  addGameData(true, true, system, rom, function (err) {
    setTimeout(function () {
      // spinner.stop()
      callback(err)
    }, 0)
  })
}

var showMenu = function (answer, last) {
  var questions = [
    {
      type: 'list',
      name: answer,
      message: 'Action',
      choices: [
        { name: 'Scrape All', value: 'all' },
        { name: 'Scrape Individual', value: 'individual' }
      ],
      default: last
    }
  ]

  return inquirer.prompt(questions)
}

clear()

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

var createNavigation = function (config, callback) {
  var active = true
  var lastAnswer
  async.whilst(function () { return active }, function (callback) {
    // TODO: handle 0 length lists
    clear()
    var header = config.header
    if (header) {
      if (_.isFunction(header)) {
        console.log(header())
      } else {
        console.log(header)
      }
    }
    if (config.once) active = false
    var cont = function (prompt) {
      var ignore = false
      listenForKey(
        prompt,
        keyFilters.backspace,
        function () {
          ignore = true
          active = false
          prompt.ui.rl.input.emit('keypress', null, {name: 'enter'})
        }
      )
      prompt.then(function (answers) {
        if (ignore) return callback(null)
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
          if (!pa) return process(answer, callback)
          return pa(answer, function (err, answer) {
            if (err) return callback(err)
            process(answer, callback)
          })
        }
        var p = _.get(process, answer)
        if (!p) return callback(new Error('Unhandled menu answer: ' + answer))
        if (_.isFunction(p)) {
          return p(callback)
        }
        createNavigation(p, callback)
      })
    }
    var prompt = config.menu(config.answer, lastAnswer, function (err, prompt) {
      if (err) return callback(err)
      cont(prompt)
    })
    if (prompt) cont(prompt)
  }, callback)
}

var createIndividualScrapeNav = function (system, callback) {
  createNavigation({
    menu: async.apply(displayAlphaList, system),
    answer: 'letter',
    process: async.apply(createFilteredRomListNav, system)
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

async.series([
  loadSystemsConfig,
  ensureFileSystem,
  loadGameLists,
  deleteMissingListGames,
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
