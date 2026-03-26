
import fs from 'fs';
import path from 'path';

const inputDir = './issues_by_type';
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));

let totalMillisAll = 0;
let countAll = 0;
let issuesList = [];
let byType = {}; // { typeName: { total, count } }
let byReqType = {}; // { reqTypeName: { total, count } }

let totalMillisFiltered = 0;
let countFiltered = 0;

// Filtros atuais do executive_report_generator.mjs
function isSlaValidForAggregation(issue, slaName) {
    const creatorId = issue.fields.creator?.accountId || "";
    const reporterId = issue.fields.reporter?.accountId || "";
    const assigneeId = issue.fields.assignee?.accountId || "";

    if (slaName === 'firstResponse') {
        if (creatorId === "qm:955b6e41-e3c5-480c-8c9f-aba4b14ef33b:3ddbe838-7745-4718-be74-388c0956fbe0") return false;
        if (creatorId === "62388a2ca2f6400069e9bc0b") return false;
        if (creatorId === "61449641e057c6006a53fa89") return false; // NOC
        if (reporterId && assigneeId && reporterId === assigneeId) return false;
        return true;
    }
    return true;
}

files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8'));
    data.forEach(issue => {
        const frSla = issue.fields.customfield_10033;
        if (frSla && frSla.completedCycles && frSla.completedCycles.length > 0) {
            const lastCycle = frSla.completedCycles[frSla.completedCycles.length - 1];
            if (lastCycle.elapsedTime && lastCycle.elapsedTime.millis !== undefined) {
                const ms = lastCycle.elapsedTime.millis;
                
                // Sem filtros
                totalMillisAll += ms;
                countAll++;
                
                const typeName = issue.fields.issuetype.name;
                if (!byType[typeName]) byType[typeName] = { total: 0, count: 0 };
                byType[typeName].total += ms;
                byType[typeName].count++;

                const reqObj = issue.fields.customfield_10010;
                const reqName = reqObj?.requestType?.name || reqObj?.name || "No Request Type";
                if (!byReqType[reqName]) byReqType[reqName] = { total: 0, count: 0 };
                byReqType[reqName].total += ms;
                byReqType[reqName].count++;

                issuesList.push({
                    key: issue.key,
                    ms: ms,
                    h: (ms / (1000 * 60 * 60)).toFixed(2),
                    start: lastCycle.startTime.friendly,
                    stop: lastCycle.stopTime.friendly,
                    type: typeName
                });

                // Com filtros
                if (isSlaValidForAggregation(issue, 'firstResponse')) {
                    // Global logic for Canva (Only Incidents and Problems)
                    if (typeName === "[System] Incident" || typeName === "[System] Problem") {
                        totalMillisFiltered += ms;
                        countFiltered++;
                    }
                }
            }
        }
    });
});

console.log(`TOTAL (Sem Filtros):`);
console.log(`- Count: ${countAll}`);
console.log(`- Média: ${(totalMillisAll / countAll / (1000 * 60 * 60)).toFixed(2)}h`);

console.log(`\nFILTERED (Com Filtros Atuais):`);
console.log(`- Count: ${countFiltered}`);
console.log(`- Média: ${(totalMillisFiltered / countFiltered / (1000 * 60 * 60)).toFixed(2)}h`);

console.log(`\nAVERAGE BY TYPE:`);
for (const [type, data] of Object.entries(byType)) {
    console.log(`- ${type}: ${(data.total / data.count / (1000 * 60 * 60)).toFixed(2)}h (Count: ${data.count})`);
}

console.log(`\nAVERAGE BY REQUEST TYPE:`);
for (const [type, data] of Object.entries(byReqType)) {
    console.log(`- ${type}: ${(data.total / data.count / (1000 * 60 * 60)).toFixed(2)}h (Count: ${data.count})`);
}

console.log(`\nTOP 20 LONG RESPONSES:`);
issuesList.sort((a, b) => b.ms - a.ms);
issuesList.slice(0, 20).forEach(iss => {
    console.log(`${iss.key} [${iss.type}]: ${iss.h}h (De ${iss.start} Até ${iss.stop})`);
});
