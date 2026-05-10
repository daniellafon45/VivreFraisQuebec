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
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
}

function isValidImage(title) {
    const t = title.toLowerCase();
    if (!t.endsWith('.jpg') && !t.endsWith('.jpeg')) return false;

    const badWords = [
        'blason', 'logo', 'drapeau', 'flag', 'map', 'carte',
        'armoiries', 'arms', 'icon', 'shield', 'location',
        'locator', 'symbole', 'graph', 'chart', 'mrc', 'province',
        'quebec_', 'canada_', 'couple', 'politique', 'maire', 'portrait', 'armoiries'
    ];
    for (const word of badWords) {
        if (t.includes(word)) return false;
    }
    return true;
}

async function fetchWikiImagesForTitle(title) {
    const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=images&titles=${encodeURIComponent(title)}&format=json&imlimit=100&redirects=1`;
    console.log('Fetching', url);
    let data = await httpsGet(url);
    if (!data || !data.query || !data.query.pages) return [];
    let pages = data.query.pages;
    let pageId = Object.keys(pages)[0];
    if (pageId === '-1' || !pages[pageId].images) return [];

    let valid = pages[pageId].images.filter(img => isValidImage(img.title));
    console.log('Valid images for', title, valid.map(v => v.title));
    return valid;
}

async function getWikiImage(cityName) {
    let qCity = cityName;
    let validImages = await fetchWikiImagesForTitle(qCity);

    if (validImages.length === 0) {
        validImages = await fetchWikiImagesForTitle(qCity + " (Québec)");
    }

    if (validImages.length === 0) {
        validImages = await fetchWikiImagesForTitle(qCity + " (ville)");
    }

    if (validImages.length === 0) return null;

    let selectedImageTitle = null;
    let bestScore = -1;
    for (const img of validImages) {
        const t = img.title.toLowerCase();
        let score = 0;
        if (t.includes('centre-ville') || t.includes('downtown')) score += 10;
        if (t.includes('panorama') || t.includes('vue') || t.includes('skyline')) score += 5;
        if (t.includes('montage')) score += 15;
        if (t.includes('hotel de ville') || t.includes('hotel_de_ville')) score -= 2;
        if (t.includes('mairie')) score -= 2;
        if (t.includes(cityName.toLowerCase())) score += 3;

        if (score > bestScore) {
            bestScore = score;
            selectedImageTitle = img.title;
        }
    }

    if (!selectedImageTitle && validImages.length > 0) {
        selectedImageTitle = validImages[0].title;
    }
    console.log('Selected image title:', selectedImageTitle);

    if (!selectedImageTitle) return null;

    const imgQ = encodeURIComponent(selectedImageTitle);
    const imgUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=imageinfo&titles=${imgQ}&iiprop=url&format=json`;
    let imgData = await httpsGet(imgUrl);

    let imgPages = imgData.query.pages;
    let imgPageId = Object.keys(imgPages)[0];
    return imgPages[imgPageId].imageinfo[0].url;
}

async function run() {
    let img = await getWikiImage('Alma');
    console.log('Alma result:', img);
}

run();
