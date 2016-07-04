'use strict'

var _ = require('lodash')
var log = global.log

// set offline to all users on startup
global.botDB.update({$where: function () { return this._id.startsWith('user') }}, {$set: {isOnline: false, partedTime: new Date().getTime()}}, {multi: true})

function User (username) {
  this.loaded = false
  this.username = username
  this.data = {}
  this.loadFromDB(username)
}

User.prototype.loadFromDB = function (username) {
  var self = this
  global.botDB.findOne({_id: 'user_' + username}, function (err, item) {
    if (err) log.error(err)
    if (!_.isNull(item)) self.data = item
    self.loaded = true
  })
}

User.prototype.isLoaded = function () {
  var self = this
  return new Promise(function (resolve, reject) {
    global.botDB.findOne({_id: 'user_' + self.username}, function (err, item) {
      if (err) reject(err)
      if (!_.isNull(item)) self.data = item
      self.loaded = true
      resolve(self.loaded)
    })
  })
}

User.prototype.setOnline = function () {
  global.botDB.update({_id: 'user_' + this.username}, {$set: {isOnline: true, username: this.username}}, {upsert: true})
  this.data.isOnline = true
}

User.prototype.setOffline = function () {
  global.botDB.update({_id: 'user_' + this.username}, {$set: {isOnline: false, partedTime: new Date().getTime(), username: this.username}}, {upsert: true})
  this.data.isOnline = false
}

User.prototype.get = function (attr) {
  return this.data[attr]
}

User.prototype.set = function (attr, value) {
  var toUpdate = {username: this.username}
  toUpdate[attr] = value
  global.botDB.update({_id: 'user_' + this.username}, {$set: toUpdate}, {upsert: true})
  this.data[attr] = value
}

User.getAllOnline = function () {
  return new Promise(function (resolve, reject) {
    global.botDB.find({isOnline: true}, function (err, items) {
      if (err) reject(err)
      resolve(items)
    })
  })
}

module.exports = User