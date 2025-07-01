const fs = require('fs')
const path = require('path')

function updateServerConfig(ipAddress) {
  const configPath = path.join(__dirname, '../config/server.js')

  const configContent = `// Server configuration for React Native
// Change this IP to your computer's IP address for phone testing
const SERVER_CONFIG = {
  // For phone testing: Use your computer's IP address (e.g., '192.168.1.100')
  // For web testing: Use 'localhost'
  SERVER_URL: 'http://${ipAddress}:3001', // Change this to your computer's IP
  PORT: 3001
};

module.exports = SERVER_CONFIG;
`

  try {
    fs.writeFileSync(configPath, configContent)
    console.log(`✅ Updated server config with IP: ${ipAddress}`)
    console.log(`📱 Server URL: http://${ipAddress}:3001`)
  } catch (error) {
    console.error('❌ Error updating config:', error.message)
  }
}

// Get IP from command line argument
const ipAddress = process.argv[2]

if (!ipAddress) {
  console.log('❌ Please provide an IP address:')
  console.log('   node scripts/update-ip.js <your-ip-address>')
  console.log('\n💡 To find your IP, run:')
  console.log('   node scripts/find-ip.js')
  process.exit(1)
}

updateServerConfig(ipAddress)
