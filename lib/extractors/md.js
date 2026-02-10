var fs = require( 'fs' )
  , marked = require( 'marked' )
  , htmlExtract = require( './html' )
  ;

function extractText( filePath, options, cb ) {
  fs.readFile( filePath, function( error, data ) {
    if ( error ) {
      cb( error, null );
      return;
    }

    try {
      htmlExtract.extractFromText( marked.parse( data.toString() ), options, cb );
    } catch ( err ) {
      cb( err, null );
    }
  });
}

module.exports = {
  types: ['text/x-markdown', 'text/markdown'],
  extract: extractText
};
