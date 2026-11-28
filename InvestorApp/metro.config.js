const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const defaults = getDefaultConfig(__dirname);

// Native build outputs are not Metro inputs. Exclude them to keep CMake/Gradle
// writes from invalidating the JS graph during an ordinary Android dev build.
const config = {
  resolver: {
    blockList: [
      defaults.resolver.blockList,
      /[/\\]android[/\\](?:.*[/\\])?(?:build|\.cxx)[/\\]/,
      /[/\\]ios[/\\](?:build|Pods)[/\\]/,
    ],
  },
};
module.exports = mergeConfig(defaults, config);
