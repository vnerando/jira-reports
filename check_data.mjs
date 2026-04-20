import fs from 'fs';
try {
    const raw = fs.readFileSync('c:/Users/User/Documents/jira-reports/raw_data/response.json');
    // Handle both UTF-8 and UTF-16LE
    let content = '';
    if (raw[0] === 0xFF && raw[1] === 0xFE) {
        content = raw.toString('utf16le');
    } else {
        content = raw.toString('utf8');
    }
    
    // Find the first { and last } to strip text headers
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1) {
        console.error('No JSON found');
        process.exit(1);
    }
    const jsonStr = content.substring(start, end + 1);
    const data = JSON.parse(jsonStr);
    
    if (!data.issues) {
        console.error('No issues field in JSON');
        process.exit(1);
    }
    
    const dates = data.issues.map(i => i.fields.created).sort();
    console.log(`Summary:`);
    console.log(`Total Issues: ${data.issues.length}`);
    console.log(`Min Date: ${dates[0]}`);
    console.log(`Max Date: ${dates[dates.length - 1]}`);
    
    // Check for some summaries to see what we're working with
    const topSummaries = {};
    data.issues.forEach(i => {
        const s = i.fields.summary;
        topSummaries[s] = (topSummaries[s] || 0) + 1;
    });
    
    const recurring = Object.entries(topSummaries)
        .filter(([s, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);
    
    console.log('\nTop recurring summaries (preliminary):');
    recurring.slice(0, 10).forEach(([s, count]) => console.log(`${count}x - ${s}`));

} catch (e) {
    console.error('Error:', e.message);
}
