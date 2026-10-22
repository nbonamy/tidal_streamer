
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

    const bonjour = new Bonjour(undefined, error => console.log(error))
    const browser = bonjour.find({ type: service_type, protocol: 'tcp' })
    browser.on('error', error => {
      console.log(error)
    })

    // now real handler
    browser.on('up', service => {
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
    });
    browser.on('down', service => {
      //console.log(`Device lost ${service.name}`)
      this.cbDown(service.name)
    })
  }

}
