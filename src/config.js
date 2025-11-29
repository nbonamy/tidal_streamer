
const YAML = require('yaml')
const fs = require('fs')

FILENAME = 'config.yml'

module.exports = class {

  constructor() {
    this.reload()
  }

  reload() {
    this._init()
    this._load()
  }

  _init() {
  }

  _load() {

    try {
      var config = fs.readFileSync(FILENAME, { encoding: 'utf8' })
      Object.assign(this, YAML.parse(config))
    } catch (err) {
    }

    // backward compatibility: migrate single auth to users array
    if (this.auth && !this.users) {
      this.users = [this.auth]
      delete this.auth
    }

    // ensure users array exists
    if (!this.users) {
      this.users = []
    }

    // save config
    this.save()

  }

  save() {
    //console.log(this)
    fs.writeFileSync(FILENAME, YAML.stringify(this))
  }

  getUser(userId) {
    if (!userId && this.users.length > 0) {
      return this.users[0]
    }
    return this.users.find(u => u.user.id == userId)
  }

  getUserById(userId) {
    return this.users.find(u => u.user.id == userId)
  }

  addOrUpdateUser(userAuth) {
    const existingIndex = this.users.findIndex(u => u.user.id === userAuth.user.id)
    if (existingIndex >= 0) {
      this.users[existingIndex] = userAuth
    } else {
      this.users.push(userAuth)
    }
    this.save()
  }

}
