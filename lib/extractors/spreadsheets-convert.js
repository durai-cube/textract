var childProcess = require( 'child_process' )
  , fs = require( 'fs' )
  , os = require( 'os' )
  , path = require( 'path' )
  , xlsxExtractor = require( './xlsx' )
  ;

function detectSoffice( cb ) {
  childProcess.execFile( 'soffice', ['--version'], function( err ) {
    if ( !err ) {
      cb( null, 'soffice' );
      return;
    }

    childProcess.execFile( 'libreoffice', ['--version'], function( err2 ) {
      if ( !err2 ) {
        cb( null, 'libreoffice' );
        return;
      }
      cb( new Error( 'LibreOffice (soffice) not found' ), null );
    } );
  } );
}

function convertToXlsx( sofficeCmd, filePath, cb ) {
  fs.mkdtemp( path.join( os.tmpdir(), 'textract-spreadsheet-' ), function( err, tmpDir ) {
    if ( err ) {
      cb( err, null );
      return;
    }

    var baseName = path.basename( filePath, path.extname( filePath ) );
    var expectedOut = path.join( tmpDir, baseName + '.xlsx' );

    var args = ['--headless', '--convert-to', 'xlsx', '--outdir', tmpDir, filePath];

    childProcess.execFile( sofficeCmd, args, function( execErr ) {
      if ( execErr ) {
        cleanupTempDir( tmpDir, function() {
          cb( new Error( 'LibreOffice conversion failed for [[ ' + path.basename( filePath ) + ' ]]: ' + execErr.message ), null );
        } );
        return;
      }

      fs.access( expectedOut, fs.constants.F_OK, function( accessErr ) {
        if ( !accessErr ) {
          cb( null, { tmpDir: tmpDir, outPath: expectedOut } );
          return;
        }

        // LibreOffice sometimes tweaks names; fall back to the first .xlsx output.
        fs.readdir( tmpDir, function( readErr, files ) {
          if ( readErr ) {
            cleanupTempDir( tmpDir, function() {
              cb( readErr, null );
            } );
            return;
          }

          var candidate = ( files || [] ).find( function( f ) {
            return path.extname( f ).toLowerCase() === '.xlsx';
          } );

          if ( !candidate ) {
            cleanupTempDir( tmpDir, function() {
              cb( new Error( 'LibreOffice conversion produced no .xlsx output for [[ ' + path.basename( filePath ) + ' ]]' ), null );
            } );
            return;
          }

          cb( null, { tmpDir: tmpDir, outPath: path.join( tmpDir, candidate ) } );
        } );
      } );
    } );
  } );
}

function cleanupTempDir( tmpDir, cb ) {
  fs.rm( tmpDir, { recursive: true, force: true }, function() {
    cb();
  } );
}

function extractText( filePath, options, cb ) {
  detectSoffice( function( detectErr, sofficeCmd ) {
    if ( detectErr ) {
      cb( new Error( 'Could not extract ' + path.basename( filePath ) + ', LibreOffice (soffice) is required for this file type.' ), null );
      return;
    }

    convertToXlsx( sofficeCmd, filePath, function( convertErr, converted ) {
      if ( convertErr ) {
        cb( new Error( 'Could not extract ' + path.basename( filePath ) + ', ' + convertErr.message ), null );
        return;
      }

      xlsxExtractor.extract( converted.outPath, options, function( err, text ) {
        cleanupTempDir( converted.tmpDir, function() {
          cb( err, text );
        } );
      } );
    } );
  } );
}

function test( _options, cb ) {
  detectSoffice( function( err ) {
    if ( err ) {
      cb( false, 'LibreOffice (soffice) not installed; cannot extract legacy spreadsheet formats.' );
    } else {
      cb( true );
    }
  } );
}

module.exports = {
  // Formats ExcelJS cannot read directly; we convert via LibreOffice then parse with ExcelJS.
  types: [
    'application/vnd.ms-excel.sheet.binary.macroenabled.12',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.spreadsheet-template'
  ],
  test: test,
  extract: extractText
};
