#!/usr/bin/env node

const dgram = require('dgram')
const Commander = require('commander')
const cluster = require('cluster')
const os = require('os')
const log = require('fancy-log')

const setBlocking = require('set-blocking')

setBlocking(true)

const commander = Commander
  .option('-h, --host <host>', 'Host Name/IP.', String)
  .option('-w, --workers <workers>', 'Number of workers to fork in the cluster, default is CPU count.', parseInt)
  .option('-p, --port <port>', 'If not defined, program will use random ports.', parseInt)
  .option('-d, --delay <delay>', 'Delay in ms between packet sending (per worker). Defaults to 0.', parseInt)
  .parse(process.argv)

const port = commander.port || 55555
const workers = commander.workers || os.cpus().length + 1

const client = dgram.createSocket({ type: 'udp4', reuseAddr: true })

client.on('error', (err) => {
  log(`UDP error: \n${err.stack}`)
  client.close()
  process.exit(1)
})

client.bind(port)

function sendOne(ip, fport) {
  return new Promise((resolve, reject) => {
    const msg = Buffer.alloc(1024)
    client.send(msg, 0, msg.length, fport, ip, err => (err ? reject(err) : resolve(false)))
  })
}

function until(fn) {
  return fn().then((result) => {
    if (result) {
      return result
    }
    return until(fn)
  })
}

function runWorker() {
  until(
    () => sendOne(commander.host, port),
  )
}

if (!commander.host) {
  log('No host specified. Exiting.')
  process.exit()
}

if (cluster.isMaster) {
  for (let i = 0; i < workers; i += 1) {
    log('Started worker', i + 1)
    cluster.fork()
  }
  cluster.on('exit', (worker) => {
    log(`Worker ${worker.process.pid} died`)
  })
} else {
  runWorker()
}
