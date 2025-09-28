const { google } = require('googleapis');
const fs = require('fs');

class SheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
    this.initializeAuth();
  }

  async initializeAuth() {
    try {
      const credentials = this.loadServiceAccountCredentials();

      if (!credentials) {
        console.warn('⚠️  Service account credentials not provided. Set GOOGLE_SERVICE_ACCOUNT_KEY or add service-account-key.json');
        return;
      }

      this.auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('✅ Google Sheets authentication initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets auth:', error.message);
      throw error;
    }
  }

  async ensureAuth() {
    if (!this.sheets) {
      await this.initializeAuth();
    }
    if (!this.sheets) {
      throw new Error('Google Sheets authentication not initialized');
    }
  }

  // Get sheet data from specified range
  async getSheetData(spreadsheetId, sheetName, range = null) {
    await this.ensureAuth();
    
    try {
      const sheetRange = range || `${sheetName}!B2:B`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: sheetRange
      });

      return response.data.values || [];
    } catch (error) {
      console.error('Error getting sheet data:', error.message);
      throw new Error(`Failed to read Google Sheets: ${error.message}`);
    }
  }

  async getColumnValuesWithBackground(spreadsheetId, sheetName, columnLetter = 'B', options = {}) {
    await this.ensureAuth();

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        ranges: [`${sheetName}!${columnLetter}2:${columnLetter}`],
        includeGridData: true
      });

      const sheet = response.data.sheets?.[0];
      const gridData = sheet?.data?.[0]?.rowData || [];

      const results = [];
      const normalizedUsed = options.usedRowColor ? this.normalizeColor(options.usedRowColor) : null;

      for (let i = 0; i < gridData.length; i++) {
        const row = gridData[i];
        const cell = row.values?.[0];
        if (!cell) {
          results.push({
            rowIndex: i + 2,
            text: '',
            backgroundColor: null,
            isUsed: false
          });
          continue;
        }

        const text = (cell.formattedValue || cell.effectiveValue?.stringValue || '').trim();
        const backgroundColor = cell.effectiveFormat?.backgroundColor || null;
        const normalizedBackground = backgroundColor ? this.normalizeColor(backgroundColor) : null;

        results.push({
          rowIndex: i + 2,
          text,
          backgroundColor: normalizedBackground,
          isUsed: normalizedUsed ? normalizedBackground === normalizedUsed : false
        });
      }

      return results;
    } catch (error) {
      console.error('Error getting column data with background:', error.message);
      throw new Error(`Failed to read Google Sheets formatting: ${error.message}`);
    }
  }

  // Check if a row is marked as used (has the specified background color)
  async isRowMarkedAsUsed(spreadsheetId, sheetName, rowIndex, usedRowColor) {
    await this.ensureAuth();
    
    try {
      // Get the sheet ID first
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });
      
      const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        throw new Error(`Sheet "${sheetName}" not found`);
      }
      
      const sheetId = sheet.properties.sheetId;
      
      // Get cell formatting for the row
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
        ranges: [`${sheetName}!${rowIndex}:${rowIndex}`],
        includeGridData: true
      });

      const rowData = response.data.sheets[0].data[0].rowData[0];
      if (!rowData || !rowData.values) {
        return false;
      }

      // Check if all cells in the row have the used color background
      const normalizedUsedColor = this.normalizeColor(usedRowColor);
      
      for (const cell of rowData.values) {
        const backgroundColor = cell.effectiveFormat?.backgroundColor;
        if (!backgroundColor) {
          return false;
        }
        
        const normalizedCellColor = this.normalizeColor(backgroundColor);
        if (normalizedCellColor !== normalizedUsedColor) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking row color:', error.message);
      // If we can't check the color, assume it's not used
      return false;
    }
  }

  // Mark a row as used by setting background color
  async markRowAsUsed(spreadsheetId, sheetName, rowIndex, usedRowColor) {
    await this.ensureAuth();
    
    try {
      // Get the sheet ID
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });
      
      const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        throw new Error(`Sheet "${sheetName}" not found`);
      }
      
      const sheetId = sheet.properties.sheetId;
      const columnCount = sheet.properties.gridProperties.columnCount;
      
      // Convert hex color to RGB
      const rgbColor = this.hexToRgb(usedRowColor);
      
      // Format the row with background color
      const requests = [{
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: rowIndex - 1, // 0-based index
            endRowIndex: rowIndex,
            startColumnIndex: 0,
            endColumnIndex: columnCount
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: rgbColor
            }
          },
          fields: 'userEnteredFormat.backgroundColor'
        }
      }];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: { requests }
      });

      console.log(`✅ Row ${rowIndex} marked as used with color ${usedRowColor}`);
    } catch (error) {
      console.error('Error marking row as used:', error.message);
      throw new Error(`Failed to update row color: ${error.message}`);
    }
  }

  // Helper function to convert hex color to RGB object
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      red: parseInt(result[1], 16) / 255,
      green: parseInt(result[2], 16) / 255,
      blue: parseInt(result[3], 16) / 255,
      alpha: 1
    } : { red: 0, green: 0, blue: 0, alpha: 1 };
  }

  // Helper function to normalize color for comparison
  normalizeColor(color) {
    if (typeof color === 'string') {
      // If it's a hex string, convert to RGB
      const rgb = this.hexToRgb(color);
      return `${Math.round(rgb.red * 255)},${Math.round(rgb.green * 255)},${Math.round(rgb.blue * 255)}`;
    } else if (color && typeof color === 'object') {
      // If it's already an RGB object
      const r = Math.round((color.red || 0) * 255);
      const g = Math.round((color.green || 0) * 255);
      const b = Math.round((color.blue || 0) * 255);
      return `${r},${g},${b}`;
    }
    return '255,255,255'; // Default white
  }

  colorsMatch(colorA, colorB) {
    return this.normalizeColor(colorA) === this.normalizeColor(colorB);
  }

  loadServiceAccountCredentials() {
    const inlineValue = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const fallbackPath = './service-account-key.json';

    if (inlineValue) {
      if (fs.existsSync(inlineValue)) {
        return this.readCredentialsFile(inlineValue);
      }

      return this.parseInlineServiceAccountKey(inlineValue);
    }

    if (fs.existsSync(fallbackPath)) {
      return this.readCredentialsFile(fallbackPath);
    }

    return null;
  }

  readCredentialsFile(filePath) {
    try {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContents);
    } catch (error) {
      throw new Error(`Failed to read service account key file at ${filePath}: ${error.message}`);
    }
  }

  parseInlineServiceAccountKey(rawValue) {
    const trimmed = rawValue.trim();

    if (!trimmed) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is empty. Provide a file path, JSON string, or base64 string.');
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return this.parseJson(trimmed);
    }

    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      if (decoded.trim().startsWith('{')) {
        return this.parseJson(decoded);
      }
    } catch (error) {
      throw new Error(`Failed to decode base64 GOOGLE_SERVICE_ACCOUNT_KEY: ${error.message}`);
    }

    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY must be a path to a file, a JSON string, or a base64-encoded JSON string.');
  }

  parseJson(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Invalid Google service account JSON: ${error.message}`);
    }
  }
}

module.exports = SheetsService;
