global.expect = require('chai').expect;

var spawnSync = require( 'child_process' ).spawnSync;

global.hasCommand = function( cmd ) {
	if ( !cmd ) {
		return false;
	}

	try {
		if ( process.platform === 'win32' ) {
			return spawnSync( 'where', [cmd], { stdio: 'ignore' } ).status === 0;
		}
		// Use `command -v` for broad shell compatibility.
		return spawnSync( 'sh', ['-c', 'command -v ' + cmd + ' >/dev/null 2>&1'], { stdio: 'ignore' } ).status === 0;
	} catch ( err ) {
		return false;
	}
};

var textract = require('../lib');

global.textract = textract;
global.fromBufferWithName = textract.fromBufferWithName;
global.fromBufferWithMime = textract.fromBufferWithMime;
global.fromFileWithPath = textract.fromFileWithPath;
global.fromFileWithMimeAndPath = textract.fromFileWithMimeAndPath;
global.fromUrl = textract.fromUrl;