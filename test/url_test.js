/* eslint-disable max-len, no-unused-expressions */
/* global fromUrl */

var nodeUrl = require( 'url' );
var http = require( 'http' );
var fs = require( 'fs' );
var path = require( 'path' );
var mime = require( 'mime' );

describe( 'fromUrl tests', function() {
  var test, baseUrl, server;

  function cmdForDoc() {
    return ( process.platform === 'darwin' ) ? 'textutil' : 'antiword';
  }

  // Avoid flaky external network calls by running a tiny local HTTP server
  // that serves the existing test fixtures with appropriate content-type.
  before( function( done ) {
    var fixturesDir = path.join( __dirname, 'files' );

    server = http.createServer( function( req, res ) {
      var url = req.url || '/';

      if ( url.indexOf( '/misleading.aspx' ) === 0 ) {
        // Extension says .aspx, but content is HTML.
        var htmlPath = path.join( fixturesDir, 'test.html' );
        fs.readFile( htmlPath, function( err, data ) {
          if ( err ) {
            res.statusCode = 500;
            res.end( 'error' );
            return;
          }
          res.statusCode = 200;
          res.setHeader( 'content-type', 'text/html; charset=utf-8' );
          res.end( data );
        } );
        return;
      }

      if ( url.indexOf( '/files/' ) === 0 ) {
        var name = decodeURIComponent( url.slice( '/files/'.length ) ).split( '?' )[0];
        name = path.basename( name );
        var filePath = path.join( fixturesDir, name );

        fs.readFile( filePath, function( err2, data2 ) {
          if ( err2 ) {
            res.statusCode = 404;
            res.end( 'not found' );
            return;
          }
          res.statusCode = 200;
          res.setHeader( 'content-type', ( mime.getType( filePath ) || 'application/octet-stream' ) );
          res.end( data2 );
        } );
        return;
      }

      res.statusCode = 404;
      res.end( 'not found' );
    } );

    server.listen( 0, '127.0.0.1', function() {
      baseUrl = 'http://127.0.0.1:' + server.address().port;
      done();
    } );
  } );

  after( function( done ) {
    if ( server ) {
      server.close( done );
    } else {
      done();
    }
  } );

  it( 'will properly extract files from sites with extensions that are misleading', function( done ) {
    var url = baseUrl + '/misleading.aspx';
    fromUrl( url, function( error, text ) {
      expect( error ).to.be.null;
      expect( text ).to.be.an( 'string' );
      expect( text.substring( 0, 83 ) ).to.eql(
        ' This is a long string of text that should get extracted with new lines inserted'
      );
      done();
    } );
  } );

  it( 'take object URL', function( done ) {
    var requiredCmd = cmdForDoc();
    if ( global.hasCommand && !global.hasCommand( requiredCmd ) ) {
      this.skip();
    }

    var url = baseUrl + '/files/doc.doc'
      , urlObj = nodeUrl.parse( url )
      ;

    fromUrl( urlObj, function( error, text ) {
      expect( error ).to.be.null;
      expect( text ).to.be.an( 'string' );
      expect( text.substring( 0, 100 ) ).to.eql( ' Word Specification Sample Working Draft 04, 16 August 2002 Document identifier: wd-spectools-word-s' );
      done();
    } );
  } );

  test = function( ext, name, _text, requiredCmd ) {
    var testIt = it;

    if ( requiredCmd && global.hasCommand && !global.hasCommand( requiredCmd ) ) {
      testIt = it.skip;
    }

    testIt( 'will ' + ext + ' files', function( done ) {
      var url = baseUrl + '/files/' + encodeURIComponent( name );
      fromUrl( url, function( error, text ) {
        expect( error ).to.be.null;
        expect( text ).to.be.an( 'string' );
        expect( text.substring( 0, 100 ) ).to.eql( _text );
        done();
      } );
    } );
  };

  test(
    'doc',
    'doc.doc',
    ' Word Specification Sample Working Draft 04, 16 August 2002 Document identifier: wd-spectools-word-s',
    cmdForDoc()
  );

  test(
    'xlsx',
    'pi.xlsx',
    'This is the value of PI:,3.141592 '
  );

  test(
    'pdf',
    'pdf.pdf',
    'This is a test. Please ignore.'
  );

  test(
    'docx',
    'docx.docx',
    'This is a test Just so you know: Lorem ipsum dolor sit amet, consecutuer adipiscing elit, sed diam n'
  );

  test(
    'text/*',
    'txt.txt',
    'This is a plain old text file.'
  );

  test(
    'pptx',
    'ppt.pptx',
    'This is some title Text And a sub-title Text in Lists Bullet 1 Bullet 2 Bullet 3 Number 1 Number 2 N'
  );

  test(
    'markdown',
    'test.md',
    ' This is an h1 This is an h2 This text has been bolded and italicized '
  );


  test(
    'xml',
    'xml.xml',
    ' Empire Burlesque Bob Dylan USA Columbia 10.90 1985 Hide your heart Bonnie Tyler UK CBS Records 9.90'
  );

  test(
    'odt',
    'odt.odt',
    'This is an ODT THIS IS A HEADING More ODT'
  );

  test(
    'potx',
    'potx.potx',
    'This is a potx template Yep, a potx I had no idea These were even a thing '
  );

  test(
    'xltx',
    'xltx.xltx',
    ',,,,,, Packing Slip ,Your Company Name,,,,"July 24, 2015", , Your Company Slogan,,,,, ,,,,,, ,Addres'
  );

  test(
    'ott',
    'ott.ott',
    'This is a document template, yay templates! Woo templates get me so excited!'
  );


  test(
    'odg',
    'odg.odg',
    "This is a drawing? A drawing, a drawing! This is a drawing, Aren't you mad envious?"
  );

  test(
    'otg',
    'otg.otg',
    'This is a drawing template A drawing template. Who would really ever need to extract from one of the'
  );

  test(
    'odp',
    'odp.odp',
    "This is a title This is a slide's text This is a 2nd page And a 2nd page's content"
  );

  test(
    'otp',
    'otp.otp',
    'This is a template title Template page text 2nd prezo text'
  );
});
