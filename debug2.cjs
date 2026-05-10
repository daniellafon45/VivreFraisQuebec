const https = require('https');

const options = {
    headers: {
        'User-Agent': 'VivreFrais/1.0 (https://github.com/votre_repo) Node.js/20'
    }
};

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error('JSON parse error for', url);
                    resolve(null);
                }
            });
        }).on('error', (err) => {
            console.error('Request error', err);
            resolve(null);
        });
    });
}
// just fetch one to see if it works sequentially
async function run() {
    for (const city of ['Alma', 'Amos', 'Baie-Comeau', 'Beaconsfield', 'Sherbrooke']) {
        const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=images&titles=${encodeURIComponent(city)}&format=json&imlimit=10&redirects=1`;
        let res = await httpsGet(url);
        console.log(city, res ? 'Success' : 'Fail');
        await new Promise(r => setTimeout(r, 500));
    }
}
run();
