const fs = require('fs');
const path = require('path');

console.log('\n🔍 ========== CHECKING UPLOADS FOLDER ==========\n');

// Possible upload locations
const locations = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, 'dist', '..', 'uploads'),
    path.join(process.cwd(), 'uploads'),
];

console.log('📍 Checking possible locations:\n');

let foundPath = null;

locations.forEach((loc, index) => {
    console.log(`${index + 1}. ${loc}`);
    const exists = fs.existsSync(loc);
    console.log(`   Exists: ${exists ? '✅ YES' : '❌ NO'}`);

    if (exists && !foundPath) {
        foundPath = loc;
        console.log('   👉 This will be used!\n');
    } else {
        console.log('');
    }
});

if (!foundPath) {
    console.log('❌ UPLOADS FOLDER NOT FOUND!\n');
    console.log('Current directory:', process.cwd());
    console.log('Script directory:', __dirname);
    process.exit(1);
}

console.log('\n📂 ========== FOLDER STRUCTURE ==========\n');
console.log('Root uploads path:', foundPath);

// Check subfolders
const subfolders = ['profiles', 'products', 'variants', 'gallery', 'reviews'];

subfolders.forEach(folder => {
    const folderPath = path.join(foundPath, folder);
    const exists = fs.existsSync(folderPath);

    console.log(`\n📁 ${folder}/`);
    console.log(`   Path: ${folderPath}`);
    console.log(`   Exists: ${exists ? '✅ YES' : '❌ NO'}`);

    if (exists) {
        try {
            const files = fs.readdirSync(folderPath);
            console.log(`   Files: ${files.length}`);

            if (files.length > 0) {
                console.log(`   Samples (first 5):`);
                files.slice(0, 5).forEach(file => {
                    const filePath = path.join(folderPath, file);
                    const stats = fs.statSync(filePath);
                    const sizeKB = (stats.size / 1024).toFixed(2);
                    console.log(`      - ${file} (${sizeKB} KB)`);
                });
            }
        } catch (err) {
            console.log(`   ❌ Error reading folder: ${err.message}`);
        }
    }
});

console.log('\n🔍 ========== TESTING SPECIFIC FILE ==========\n');

// Test the file from your error
const testFile = '7027b478-6c06-4765-adcc-83f61097fc77.webp';
const testPath = path.join(foundPath, 'products', testFile);

console.log('Testing file:', testFile);
console.log('Full path:', testPath);
console.log('Exists:', fs.existsSync(testPath) ? '✅ YES' : '❌ NO');

if (fs.existsSync(testPath)) {
    const stats = fs.statSync(testPath);
    console.log('Size:', (stats.size / 1024).toFixed(2), 'KB');
    console.log('Readable:', fs.accessSync(testPath, fs.constants.R_OK) === undefined ? '✅ YES' : '❌ NO');

    // Try to read the file
    try {
        const buffer = fs.readFileSync(testPath);
        console.log('Can read:', '✅ YES');
        console.log('Buffer size:', buffer.length, 'bytes');
    } catch (err) {
        console.log('Can read:', '❌ NO');
        console.log('Error:', err.message);
    }
}

console.log('\n🔍 ========== RECOMMENDATIONS ==========\n');

console.log('For NestJS, use this path in main.ts:');
console.log(`  join(__dirname, '..', 'uploads')`);
console.log('');
console.log('This resolves to:', path.join(__dirname, '..', 'uploads'));
console.log('Which should point to:', foundPath);
console.log('');
console.log('If files are not loading:');
console.log('1. Make sure uploads/ is in the project root (same level as package.json)');
console.log('2. Restart your NestJS server');
console.log('3. Clear browser cache');
console.log('4. Check the console logs when accessing: http://localhost:3000/uploads/products/' + testFile);
console.log('\n============================================\n');