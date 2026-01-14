const fs = require('fs');
const path = require('path');

/**
 * Loads and parses a JSONL file.
 * @param {string} filename - The name of the file in the data directory (e.g., 'bookmarks.jsonl').
 * @returns {Array} An array of parsed JSON objects.
 */
function loadData(filename) {
  const filePath = path.join(__dirname, '../data', filename);
  
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) {
    return [];
  }

  return content
    .trim()
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error(`Error parsing JSON on line ${index + 1} of ${filename}: ${e.message}`);
        return null;
      }
    })
    .filter(item => item !== null);
}

/**
 * Saves an array of objects to a JSONL file.
 * @param {string} filename - The name of the file in the data directory.
 * @param {Array} data - The array of objects to save.
 */
function saveData(filename, data) {
  const filePath = path.join(__dirname, '../data', filename);
  const content = data
    .map(item => JSON.stringify(item))
    .join('\n') + '\n';
  
  fs.writeFileSync(filePath, content, 'utf8');
}

module.exports = {
  loadData,
  saveData
};

