var EPub = require( 'epub2/node' )
  , htmlExtract = require( './html' )
  ;

function extractText( filePath, options, cb ) {
  var epub = new EPub( filePath )
    , allText = ''
    , hasError = false
    , chapterCount = 0
    , chapterTexts = []
    ;

  epub.on( 'end', function() {
    // Iterate over each chapter...
    epub.flow.forEach( function( chapter, index ) {
      // if already error, don't do anything
      if ( !hasError ) {
        // Get the chapter text
        epub.getChapterRaw( chapter.id, function( rawChaperError, text ) {
          if ( rawChaperError ) {
            hasError = true;
            cb( rawChaperError, null );
          } else {
            // Extract the raw text from the chapter text (it's html)
            htmlExtract.extractFromText( text, options, function( htmlExtractError, outText ) {
              if ( htmlExtractError ) {
                hasError = true;
                cb( htmlExtractError, null );
              } else {
                chapterTexts[index] = outText;
                chapterCount++;
                if ( chapterCount === epub.flow.length ) {
                  allText = chapterTexts.join( '' );
                  cb( null, allText );
                }
              }
            });
          }
        });
      }
    });
  });

  epub.parse();
}

module.exports = {
  types: ['application/epub+zip'],
  extract: extractText
};
