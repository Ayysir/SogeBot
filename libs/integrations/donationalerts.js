'use strict'

// 3rdparty libraries
const _ = require('lodash')
const debug = require('debug')
const chalk = require('chalk')

const config = require('../../config.json')

class Donationalerts {
  constructor () {
    this.collection = 'integrations.donationalerts'
    this.socket = null

    global.panel.addMenu({category: 'main', name: 'integrations', id: 'integrations'})

    this.status()
    this.sockets()
  }

  get enabled () {
    return new Promise(async (resolve, reject) => resolve(_.get(await global.db.engine.findOne(this.collection, { key: 'enabled' }), 'value', false)))
  }
  set enabled (v) {
    (async () => {
      v = !!v // force boolean
      await global.db.engine.update(this.collection, { key: 'enabled' }, { value: v })
      this.status()
    })()
  }

  get clientSecret () {
    return new Promise(async (resolve, reject) => resolve(_.get(await global.db.engine.findOne(this.collection, { key: 'clientSecret' }), 'value', null)))
  }
  set clientSecret (v) {
    this.socket = null;

    (async () => {
      await global.db.engine.update(this.collection, { key: 'clientSecret' }, { value: _.isNil(v) || v.trim().length === 0 ? null : v })
      await this.status({ log: false })
    })()
  }

  async connect () {
    if (_.isNil(this.socket)) {
      this.socket = require('socket.io-client').connect('http://socket.donationalerts.ru:3001',
        {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: Infinity
        })
    } else this.socket.connect()
    this.socket.emit('add-user', {token: config.integrations.donationalerts.secretToken, type: 'minor'})
    this.socket.off('donation').on('donation', (data) => {
      data = JSON.parse(data)
      if (parseInt(data.alert_type, 10) !== 1) return
      let additionalData = JSON.parse(data.additional_data)
      global.overlays.eventlist.add({
        type: 'tip',
        amount: data.amount,
        currency: data.currency,
        username: data.username.toLowerCase(),
        message: data.message,
        song_title: _.get(additionalData, 'media_data.title', undefined),
        song_url: _.get(additionalData, 'media_data.url', undefined)
      })
      global.events.fire('tip', { username: data.username.toLowerCase(), amount: data.amount, message: data.message, currency: data.currency })
    })
  }
  sockets () {
    const d = debug('donationalerts:sockets')
    const io = global.panel.io.of('/integrations/donationalerts')

    io.on('connection', (socket) => {
      d('Socket /integrations/donationalerts connected, registering sockets')
      socket.on('settings', async (callback) => {
        callback(null, {
          clientSecret: await this.clientSecret,
          enabled: await this.status({ log: false })
        })
      })
      socket.on('toggle.enabled', async (cb) => {
        let enabled = await this.enabled
        this.enabled = !enabled
        cb(null, !enabled)
      })
      socket.on('set.variable', async (data, cb) => {
        try {
          this[data.key] = data.value
        } catch (e) {
          console.error(e)
        }
        cb(null, data.value)
      })
    })
  }

  async status (options) {
    options = _.defaults(options, { log: true })
    const d = debug('donationalerts:status')
    let [enabled, clientSecret] = await Promise.all([this.enabled, this.clientSecret, this.clientId, this.redirectURI, this.code, this.accessToken, this.refreshToken])
    d(enabled, clientSecret)
    enabled = !(_.isNil(clientSecret)) && enabled

    let color = enabled ? chalk.green : chalk.red
    if (options.log) global.log.info(`${color(enabled ? 'ENABLED' : 'DISABLED')}: DonationAlerts.ru Integration`)

    if (enabled) {
      this.connect()
    } else if (!enabled) {
      if (!_.isNil(this.socket)) this.socket.disconnect()
    }
    return enabled
  }
}

module.exports = new Donationalerts()
