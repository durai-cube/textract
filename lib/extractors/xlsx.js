var path = require( 'path' )
  , fs = require( 'fs' )
  , ExcelJS = require( 'exceljs' )
  ;

function looksLikeZip( filePath ) {
  var fd;
  try {
    fd = fs.openSync( filePath, 'r' );
    try {
      var buf = Buffer.alloc( 2 );
      fs.readSync( fd, buf, 0, 2, 0 );
      return buf[0] === 0x50 && buf[1] === 0x4B; // 'PK'
    } finally {
      fs.closeSync( fd );
    }
  } catch ( _err ) {
    try {
      if ( fd ) {
        fs.closeSync( fd );
      }
    } catch ( _e ) {
      // ignore
    }
    return false;
  }
}

function csvEscape( value ) {
  if ( value === null || value === undefined ) {
    return '';
  }

  value = String( value );

  if ( /["\r\n,]/.test( value ) ) {
    return '"' + value.replace( /"/g, '""' ) + '"';
  }

  return value;
}

function cellToString( cell ) {
  if ( !cell ) {
    return '';
  }

  // SheetJS sheet_to_csv only emits the value for the top-left cell of a merge.
  // ExcelJS can surface the value across the merged region; suppress non-master.
  if ( cell.isMerged && cell.master && cell.master.address && cell.address !== cell.master.address ) {
    return '';
  }

  var value = cell.value;
  if ( value === null || value === undefined ) {
    return '';
  }

  function formatDate( dateValue ) {
    try {
      return new Intl.DateTimeFormat( 'en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
      } ).format( dateValue );
    } catch ( _err ) {
      return dateValue.toISOString();
    }
  }

  if ( value instanceof Date ) {
    return formatDate( value );
  }

  // Formula cells: { formula, result }
  if ( value && typeof value === 'object' && Object.prototype.hasOwnProperty.call( value, 'formula' ) ) {
    if ( value.result === null || value.result === undefined ) {
      return '';
    }
    if ( value.result instanceof Date ) {
      return formatDate( value.result );
    }
    return String( value.result );
  }

  // Prefer formatted display text when available (number formats, etc).
  try {
    if ( typeof cell.text === 'string' && cell.text.length ) {
      return cell.text;
    }
  } catch ( _err ) {
    // cell.text can throw for some empty cells
  }

  if ( typeof value === 'object' ) {
    // Rich text: { richText: [{ text }] }
    if ( Array.isArray( value.richText ) ) {
      return value.richText.map( function( rt ) { return rt.text; } ).join( '' );
    }

    // Hyperlink: { text, hyperlink }
    if ( typeof value.text === 'string' ) {
      return value.text;
    }

    if ( value.result !== undefined && value.result !== null ) {
      return String( value.result );
    }
  }

  return String( value );
}

function worksheetToCsv( worksheet ) {
  var maxCol = 0;
  var rows = [];

  worksheet.eachRow( { includeEmpty: true }, function( row ) {
    if ( row && row.cellCount > maxCol ) {
      maxCol = row.cellCount;
    }
  } );

  worksheet.eachRow( { includeEmpty: true }, function( row ) {
    var cols = [];
    var i;

    for ( i = 1; i <= maxCol; i++ ) {
      var cell = row.getCell( i );
      cols.push( csvEscape( cellToString( cell ) ) );
    }

    rows.push( cols.join( ',' ) );
  } );

  return rows.join( '\n' );
}

function normalizeForTextract( csv, options ) {
  var preserveLineBreaks = options && options.preserveLineBreaks === true;

  if ( preserveLineBreaks ) {
    csv = csv
      .replace( /[ \t]+(\r?\n)/g, '$1' )
      .replace( /[ \t]+$/g, '' );
    if ( csv.length && !/\r?\n$/.test( csv ) ) {
      csv += '\n';
    }
  } else {
    if ( csv.length && !/\s$/.test( csv ) ) {
      csv += ' ';
    }
  }

  // Preserve intentional spaces through global cleanseText() which collapses
  // single spaces.
  csv = csv.replace( / /g, '  ' );

  return csv;
}

function extractText( filePath, options, cb ) {
  // Guardrail: do not allow text files masquerading as xlsx to be parsed.
  if ( !looksLikeZip( filePath ) ) {
    cb( new Error( 'Could not extract ' + path.basename( filePath ) + ', Error: PRN' ), null );
    return;
  }

  ( async function() {
    var workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.readFile( filePath );
    } catch ( err ) {
      cb( new Error( 'Could not extract ' + path.basename( filePath ) + ', ' + err ), null );
      return;
    }

    try {
      var out = '';
      workbook.worksheets.forEach( function( ws ) {
        out += worksheetToCsv( ws );
      } );
      out = normalizeForTextract( out, options );
      cb( null, out );
    } catch ( err2 ) {
      cb( new Error( 'Could not extract ' + path.basename( filePath ) + ', ' + err2 ), null );
    }
  } )();
}

module.exports = {
  types: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    // Macro-enabled OpenXML spreadsheets (ExcelJS can read these).
    'application/vnd.ms-excel.sheet.macroenabled.12',
    'application/vnd.ms-excel.template.macroenabled.12'
  ],
  extract: extractText
};
