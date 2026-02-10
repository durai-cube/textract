var xpath = require( 'xpath' )
  , Dom = require( '@xmldom/xmldom' ).DOMParser
  , yauzl = require( 'yauzl' )
  , util = require( '../util' )
  , slideMatch = /^ppt\/slides\/slide/
  , noteMatch = /^ppt\/notesSlides\/notesSlide/
  ;

function _domParser() {
  return new Dom({
    errorHandler: {
      warning: function() {},
      error: function() {},
      fatalError: function() {}
    }
  });
}

function _calculateExtractedText( slideText ) {
  var doc = _domParser().parseFromString( slideText, 'text/xml' )
    , ps = xpath.select( "//*[local-name()='p']", doc )
    , text = ''
    ;

  ps.forEach( function( paragraph ) {
    var ts
      , localText = ''
      ;

    paragraph = _domParser().parseFromString( paragraph.toString(), 'text/xml' );
    ts = xpath.select( "//*[local-name()='t' or local-name()='tab' or local-name()='br']",
      paragraph );
    ts.forEach( function( t ) {
      if ( t.localName === 't' && t.childNodes.length > 0 ) {
        localText += t.childNodes[0].data;
      } else {
        if ( t.localName === 'tab' || t.localName === 'br' ) {
          localText += '';
        }
      }
    });
    text += localText + '\n';
  });

  return text;
}

function extractText( filePath, options, cb ) {
  var parts = []
    , processedEntries = 0
    , hasErrored = false
    ;

  yauzl.open( filePath, function( err, zipfile ) {
    function processEnd() {
      var text;
      if ( hasErrored ) {
        return;
      }
      if ( zipfile.entryCount === ++processedEntries ) {
        if ( parts.length ) {
          parts.sort( function( a, b ) {
            if ( a.slide !== b.slide ) {
              return a.slide - b.slide;
            }
            if ( a.kind === b.kind ) {
              return 0;
            }
            return a.kind === 'slide' ? -1 : 1;
          });

          text = parts.map( function( part ) {
            return _calculateExtractedText( part.text );
          }).join( '' );

          cb( null, text );
        } else {
          cb(
            new Error( 'Extraction could not find slides in file, are you' +
              ' sure it is the mime type it says it is?' ),
            null );
        }
      }
    }

    if ( err ) {
      util.yauzlError( err, cb );
      return;
    }

    zipfile.on( 'entry', function( entry ) {
      if ( slideMatch.test( entry.fileName ) || noteMatch.test( entry.fileName ) ) {
        util.getTextFromZipFile( zipfile, entry, function( err2, text ) {
          var match, slide, kind;
          if ( hasErrored ) {
            return;
          }
          if ( err2 ) {
            hasErrored = true;
            cb( err2 );
            return;
          }

          match = entry.fileName.match( /(?:slide|notesSlide)(\d+)\.xml$/ );
          slide = match ? +match[1] : 0;
          kind = slideMatch.test( entry.fileName ) ? 'slide' : 'note';
          parts.push({ slide: slide, kind: kind, text: text });
          processEnd();
        });
      } else {
        processEnd();
      }
    });

    zipfile.on( 'error', function( err3 ) {
      cb( err3 );
    });
  });
}

module.exports = {
  types: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.template'],
  extract: extractText
};
