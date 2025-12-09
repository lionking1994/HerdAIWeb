module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Find the source-map-loader rule and modify it to ignore missing source maps
      const sourceMapLoaderRule = webpackConfig.module.rules.find(
        rule => rule.use && rule.use.some && rule.use.some(use => 
          use.loader && use.loader.includes('source-map-loader')
        )
      );

      if (sourceMapLoaderRule) {
        sourceMapLoaderRule.use.forEach(use => {
          if (use.loader && use.loader.includes('source-map-loader')) {
            use.options = {
              ...use.options,
              filterSourceMappingUrl: (url, resourcePath) => {
                // Ignore source maps for problematic packages
                if (resourcePath.includes('node_modules')) {
                  if (resourcePath.includes('d3-') || 
                      resourcePath.includes('styled-components') ||
                      resourcePath.includes('victory-vendor') ||
                      resourcePath.includes('@xyflow')) {
                    return false;
                  }
                }
                return true;
              }
            };
          }
        });
      }

      return webpackConfig;
    },
  },
};
