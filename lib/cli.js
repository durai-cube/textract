var path = require( 'path' )
  , textract = require( './index' );

module.exports = function( filePath, flags ) {
  filePath = path.resolve( process.cwd(), filePath );

  // Default to preserving line breaks for CLI output readability.
  if ( flags.preserveLineBreaks === undefined ) {
    flags.preserveLineBreaks = true;
  } else if ( flags.preserveLineBreaks === 'false' || flags.preserveLineBreaks === false ) {
    flags.preserveLineBreaks = false;
  } else if ( flags.preserveLineBreaks === 'true' || flags.preserveLineBreaks === true ) {
    flags.preserveLineBreaks = true;
  }

  if ( flags.preserveOnlyMultipleLineBreaks === 'true' || flags.preserveOnlyMultipleLineBreaks === true ) {
    flags.preserveOnlyMultipleLineBreaks = true;
  } else if ( flags.preserveOnlyMultipleLineBreaks === 'false' || flags.preserveOnlyMultipleLineBreaks === false ) {
    flags.preserveOnlyMultipleLineBreaks = false;
  }

  textract.fromFileWithPath( filePath, flags, function( error, text ) {
    if ( error ) {
      // eslint-disable-next-line no-console
      console.error( error );
    } else {
      // eslint-disable-next-line no-console
      console.log( text );
    }
  });
};
