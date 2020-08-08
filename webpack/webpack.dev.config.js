const path = require('path');
const baseConfig = require('./webpack.base.config');
const { merge } = require('webpack-merge');

const libraryTarget = [{
    type: "var",
    name: 'taj.js'
}, {
    type: "commonjs2",
    name: 'taj.commonjs2.js'
}];

function getConfigForTaget(target) {
    return {
        devtool: 'source-map',
        output: {
            path: path.join(__dirname, "../build"),
            filename: target.name,
            library: 'taj',
            libraryTarget: target.type
        }
    }
}

function createConfigsForAllLibraryTarget() {
    var configs = [];
    libraryTarget.forEach(function (target) {
        configs.push(merge(baseConfig[0], getConfigForTaget(target)));
    })
    return configs;
}

module.exports = [...createConfigsForAllLibraryTarget()]