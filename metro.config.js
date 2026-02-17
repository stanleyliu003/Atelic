const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // If anything tries to import axios, force it to the browser version
  if (moduleName === 'axios' || moduleName.startsWith('axios/')) {
    return context.resolveRequest(context, 'axios/dist/browser/axios.cjs', platform);
  }
  
  // For everything else, use the default behavior
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;