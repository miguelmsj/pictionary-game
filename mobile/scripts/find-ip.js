const os = require('os')

function findLocalIP() {
  const interfaces = os.networkInterfaces()

  console.log('🔍 Finding your local IP address...\n')

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`✅ Found IP: ${iface.address}`)
        console.log(`📱 Update mobile/config/server.js with this IP:`)
        console.log(`   SERVER_URL: 'http://${iface.address}:3001'`)
        console.log('\n🔧 To update automatically, run:')
        console.log(`   node scripts/update-ip.js ${iface.address}`)
        return iface.address
      }
    }
  }

  console.log('❌ No external IP found. Using localhost.')
  return 'localhost'
}

if (require.main === module) {
  findLocalIP()
}

module.exports = { findLocalIP }
