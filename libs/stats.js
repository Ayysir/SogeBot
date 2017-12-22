'use strict'
var _ = require('lodash')
const debug = require('debug')

function Stats () {
  this.latestTimestamp = 0
  global.panel.socketListening(this, 'getLatestStats', this.getLatestStats)
  global.panel.socketListening(this, 'getApiStats', this.getApiStats)
}

Stats.prototype.save = async function (data) {
  if (data.timestamp - this.latestTimestamp >= 30000) {
    let stats = await global.db.engine.findOne('stats', {'whenOnline': data.whenOnline})

    // pseudo avg value through stream
    data.currentViewers = Math.round((data.currentViewers + _.get(stats, 'currentViewers', data.currentViewers)) / 2)
    data.currentHosts = Math.round((data.currentHosts + _.get(stats, 'currentHosts', data.currentHosts)) / 2)

    global.db.engine.update('stats', {'whenOnline': data.whenOnline}, data)
    this.latestTimestamp = data.timestamp
  }
}
Stats.prototype.getLatestStats = async function (self, socket) {
  let stats = await global.db.engine.find('stats')
  if (stats.length > 1) {
    // get second stream (first is current stream)
    stats = _.orderBy(stats, 'timestamp', 'desc')[1]
  } else stats = {}
  socket.emit('latestStats', stats)
}

Stats.prototype.getApiStats = async function (self, socket) {
  const d = debug('stats:getApiStats')
  let stats = await global.db.engine.find('APIStats')
  // return hour of data
  socket.emit('APIStats', _.filter(stats, (o) => _.now() - o.timestamp < 1000 * 60 * 60))

  // remove data older than 2h
  stats = _.filter(stats, (o) => _.now() - o.timestamp >= 2000 * 60 * 60)
  d('Stats to delete: %j', stats)
  for (let s of stats) {
    await global.db.engine.remove('APIStats', { _id: s._id.toString() })
  }
}

module.exports = Stats
