var convertExtractor = require( './spreadsheets-convert' );

module.exports = {
  // Kept for backward compatibility: handle .xls via the LibreOffice conversion path.
  types: [
    'application/vnd.ms-excel'
  ],
  test: convertExtractor.test,
  extract: convertExtractor.extract
};
