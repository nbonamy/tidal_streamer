
const net = require('net')
const { Bonjour } = require('bonjour-service')

module.exports = class {

  constructor(cbUp, cbDown, device_type = 'tidal', service_type = 'tidalconnect') {
    this.cbUp = cbUp
    this.cbDown = cbDown
    this.device_type = device_type
    this.service_type = service_type
    this._discover()
  }

  _discover() {
    this._discover_by_type(this.device_type, this.service_type)
  }

  _discover_by_type(device_type, service_type) {

    this._bonjour = new Bonjour(undefined, error => console.log(error))
    const browser = this._browser = this._bonjour.find({ type: service_type, protocol: 'tcp' })
    browser.on('error', error => {
      console.log(error)
    })

    // now real handler
    const onService = service => {
      for (let service_ip of service.addresses) {
        if (net.isIPv4(service_ip)) {
          //console.log(`Device found ${service.name}: ${service.host}:${service.port}`)
          this.cbUp({
            name: service.name,
            description: service.txt?.fn || service.name,
            type: device_type,
            ip: service_ip,
            host: service.host,
            port: service.port,
          })
          break
        }
      }
    }
    browser.on('up', onService)
    browser.on('srv-update', onService)
    browser.on('txt-update', onService)
    browser.on('down', service => {
      //console.log(`Device lost ${service.name}`)
      this.cbDown(service.name)
    })

    let lastQuery = Date.now()
    this._expiryTimer = setInterval(() => {
      browser.expire()
      const now = Date.now()
      // Query before cached records expire, even if a device never says goodbye.
      const needsRefresh = browser.services.some(service =>
        service.ttl > 0 && now >= service.lastSeen + service.ttl * 800)
      if (needsRefresh || now - lastQuery >= 30000) {
        browser.update()
        lastQuery = now
      }
    }, 1000)
    this._expiryTimer.unref()
  }

  close() {
    if (!this._bonjour) return
    clearInterval(this._expiryTimer)
    this._browser.stop()
    this._bonjour.destroy()
    this._bonjour = null
  }

}
