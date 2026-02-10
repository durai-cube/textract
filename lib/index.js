var fs = require( 'fs' )
  , path = require( 'path' )
  , mime = require( 'mime' )
  , extract = require( './extract' )
  , os = require( 'os' )
  , tmpDir = os.tmpdir()
  ;

function _genRandom() {
  return Math.floor( ( Math.random() * 100000000000 ) + 1 );
}

function _extractWithType( type, filePath, options, cb ) {
  fs.access( filePath, fs.constants.F_OK, function( err ) {
    if ( !err ) {
      extract( type, filePath, options, cb );
      return;
    }
    cb( new Error( 'File at path [[ ' + filePath + ' ]] does not exist.' ), null );
  } );
}

function _returnArgsError( _args ) {
  var args = Array.prototype.slice.call( _args )
    , callback
    ;

  args.forEach( function( parm ) {
    if ( parm && typeof parm === 'function' ) {
      callback = parm;
    }
  });

  if ( callback ) {
    callback( new Error( 'Incorrect parameters passed to textract.' ), null );
  } else {
    // eslint-disable-next-line no-console
    console.error( 'textract could not find a callback function to execute.' );
  }
}

function _writeBufferToDisk( buff, type, originalPathOrName, cb ) {
  var ext = '';

  if ( typeof originalPathOrName === 'string' ) {
    ext = path.extname( originalPathOrName );
  }

  if ( !ext && typeof type === 'string' ) {
    try {
      ext = mime.getExtension( type );
      if ( ext ) {
        ext = '.' + ext;
      }
    } catch ( _err ) {
      // ignore
    }
  }

  var fullPath = path.join( tmpDir, 'textract_file_' + _genRandom() + ( ext || '' ) );

  fs.open( fullPath, 'w', function( err, fd ) {
    if ( err ) {
      throw new Error( 'error opening temp file: ' + err );
    } else {
      fs.write( fd, buff, 0, buff.length, null, function( err2 ) {
        if ( err2 ) {
          throw new Error( 'error writing temp file: ' + err2 );
        } else {
          fs.close( fd, function() {
            cb( fullPath );
          });
        }
      });
    }
  });
}

function fromFileWithMimeAndPath( type, filePath, options, cb ) {
  var called = false;

  if ( typeof type === 'string' && typeof filePath === 'string' ) {
    if ( typeof cb === 'function' && typeof options === 'object' ) {
      // (mimeType, filePath, options, callback)
      _extractWithType( type, filePath, options, cb );
      called = true;
    } else if ( typeof options === 'function' && cb === undefined ) {
      // (mimeType, filePath, callback)
      _extractWithType( type, filePath, {}, options );
      called = true;
    }
  }

  if ( !called ) {
    _returnArgsError( arguments );
  }
}

function fromFileWithPath( filePath, options, cb ) {
  var type;
  if ( typeof filePath === 'string' &&
       ( typeof options === 'function' || typeof cb === 'function' ) ) {
    type = ( options && options.typeOverride ) || mime.getType( filePath );
    fromFileWithMimeAndPath( type, filePath, options, cb );
  } else {
    _returnArgsError( arguments );
  }
}

// eslint-disable-next-line no-unused-vars
function fromBufferWithMime( type, bufferContent, options, cb, withPath ) {
  if ( typeof type === 'string' &&
       bufferContent &&
       Buffer.isBuffer( bufferContent ) &&
       ( typeof options === 'function' || typeof cb === 'function' ) ) {
    _writeBufferToDisk( bufferContent, type, withPath, function( newPath ) {
      fromFileWithMimeAndPath( type, newPath, options, cb );
    });
  } else {
    _returnArgsError( arguments );
  }
}

function fromBufferWithName( filePath, bufferContent, options, cb ) {
  var type;
  if ( typeof filePath === 'string' ) {
    type = mime.getType( filePath );
    fromBufferWithMime( type, bufferContent, options, cb, filePath );
  } else {
    _returnArgsError( arguments );
  }
}

function fromUrl( url, options, cb ) {
  var urlNoQueryParams, extname, filePath, fullFilePath, file, href, callbackCalled;

  // allow url to be either a string or to be a
  // Node URL Object: https://nodejs.org/api/url.html
  href = ( typeof url === 'string' ) ? url : url.href;

  // support (url, cb)
  if ( typeof options === 'function' && cb === undefined ) {
    cb = options;
    options = {};
  }

  if ( href ) {
    options = options || {};
    urlNoQueryParams = href.split( '?' )[0];
    extname = path.extname( urlNoQueryParams );
    filePath = _genRandom() + extname;
    fullFilePath = path.join( tmpDir, filePath );
    file = fs.createWriteStream( fullFilePath );

    file.on( 'finish', function() {
      if ( !callbackCalled ) {
        fromFileWithPath( fullFilePath, options, cb );
      }
    } );

    file.on( 'error', function( error ) {
      if ( callbackCalled ) {
        return;
      }
      callbackCalled = true;
      cb( error );
    });

    // Use Node 24's built-in fetch to avoid extra HTTP deps.
    // Allow callers to provide a timeout via options.fetchTimeout (ms).
    var fetchTimeout = ( options && typeof options.fetchTimeout === 'number' ) ? options.fetchTimeout : 30000;
    var controller = new AbortController();
    var timeoutId = setTimeout( function() {
      try {
        controller.abort( new Error( 'Error fetching URL [[ ' + href + ' ]], timeout after ' + fetchTimeout + 'ms' ) );
      } catch ( _err ) {
        controller.abort();
      }
    }, fetchTimeout );

    fetch( href, { signal: controller.signal } )
      .then( function( response ) {
        clearTimeout( timeoutId );

        if ( !response.ok ) {
          throw new Error( 'Error fetching URL [[ ' + href + ' ]], status: ' + response.status );
        }

        if ( !options.typeOverride ) {
          var contentType = response.headers.get( 'content-type' );
          if ( contentType ) {
            options.typeOverride = contentType.split( /;/ )[0];
          }
        }

        if ( !response.body ) {
          file.end();
          return;
        }

        // Convert Web stream -> Node stream
        // eslint-disable-next-line global-require
        var Readable = require( 'stream' ).Readable;
        Readable.fromWeb( response.body ).pipe( file );
      })
      .catch( function( error ) {
        clearTimeout( timeoutId );

        if ( callbackCalled ) {
          return;
        }
        callbackCalled = true;
        try {
          file.destroy();
        } catch ( _err ) {
          // ignore
        }
        cb( error );
      } );
  } else {
    _returnArgsError( arguments );
  }
}

module.exports = {
  fromFileWithPath: fromFileWithPath,
  fromFileWithMimeAndPath: fromFileWithMimeAndPath,
  fromBufferWithName: fromBufferWithName,
  fromBufferWithMime: fromBufferWithMime,
  fromUrl: fromUrl
};
