
const net = require('net')
const mdns = require('mdns')

module.exports = class {

  constructor(cbUp, cbDown) {
    this.cbUp = cbUp
    this.cbDown = cbDown
    this._discover()
  }

  _discover() {
    this._discover_by_type('tidal', 'tidalconnect')
  }

  _discover_by_type(device_type, service_type) {

    // getaddr fails: https://stackoverflow.com/questions/29589543/raspberry-pi-mdns-getaddrinfo-3008-error
    const browser = mdns.createBrowser(mdns.tcp(service_type), { resolverSequence: [
      mdns.rst.DNSServiceResolve(),
      'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({families:[4]}),
      mdns.rst.makeAddressesUnique()
    ]});
    browser.on('error', error => {
      console.log(error)
    })

    // now real handler
    browser.on('serviceUp', service => {
      for (let service_ip of service.addresses) {
        if (net.isIPv4(service_ip)) {
          //console.log(`Device found ${service.name}: ${service.host}:${service.port}`)
          this.cbUp({
            name: service.name,
            description: service.txtRecord?.fn || service.name,
            type: device_type,
            ip: service_ip,
            host: service.host,
            port: service.port,
          })
          break
        }
      }
    });
    browser.on('serviceDown', service => {
      //console.log(`Device lost ${service.name}`)
      this.cbDown(service.name)
    })
    browser.start()
  }

}
