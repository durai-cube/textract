var htmlExtract = require( './html' );

function getEPubCtor() {
  // eslint-disable-next-line global-require
  var epub = require( 'epub' );
  return epub && ( epub.EPub || epub.default || epub );
}

function getChapterRaw( epub, chapterId ) {
  var maybePromise = epub.getChapterRaw( chapterId );
  if ( maybePromise && typeof maybePromise.then === 'function' ) {
    return maybePromise;
  }

  return new Promise( function( resolve, reject ) {
    epub.getChapterRaw( chapterId, function( chapterError, text ) {
      if ( chapterError ) {
        reject( chapterError );
      } else {
        resolve( text );
      }
    });
  });
}

function extractChapterText( text, options ) {
  return new Promise( function( resolve, reject ) {
    htmlExtract.extractFromText( text, options, function( htmlExtractError, outText ) {
      if ( htmlExtractError ) {
        reject( htmlExtractError );
      } else {
        resolve( outText );
      }
    });
  });
}

async function extractText( filePath, options, cb ) {
  try {
    var EPub = getEPubCtor();
    var epub = new EPub( filePath );

    await epub.parse();

    var chapterTexts = await Promise.all(
      epub.flow.map( async function( chapter ) {
        var rawText = await getChapterRaw( epub, chapter.id );
        return extractChapterText( rawText, options );
      })
    );

    cb( null, chapterTexts.join( '' ) );
  } catch ( error ) {
    cb( error, null );
  }
}

module.exports = {
  types: ['application/epub+zip'],
  extract: extractText
};
