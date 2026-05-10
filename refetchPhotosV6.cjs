const fs = require('fs');
const https = require('https');

const options = {
    headers: {
        'User-Agent': 'VivreFraisBot/1.0 (https://github.com/votre_repo) Node.js'
    }
};

function httpsGet(url) {
    return new Promise((resolve) => {
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.error('HTTP', res.statusCode, 'on', url);
                    return resolve(null);
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error('PARSE ERR on', url, 'data:', data.substring(0, 50));
                    resolve(null);
                }
            });
        }).on('error', err => {
            console.error('HTTP ERR', err);
            resolve(null);
        });
    });
}

function isValidImage(title) {
    const t = title.toLowerCase();
    if (!t.endsWith('.jpg') && !t.endsWith('.jpeg')) return false;

    const badWords = [
        'blason', 'logo', 'drapeau', 'flag', 'map', 'carte',
        'armoiries', 'arms', 'icon', 'shield', 'location',
        'locator', 'symbole', 'graph', 'chart', 'mrc', 'province',
        'quebec_', 'canada_', 'couple', 'politique', 'maire', 'portrait', 'armoir', 'seal'
    ];
    for (const word of badWords) {
        if (t.includes(word)) return false;
    }
    return true;
}

async function fetchWikiImagesForTitle(title) {
    const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=images&titles=${encodeURIComponent(title)}&format=json&imlimit=100&redirects=1`;
    let data = await httpsGet(url);
    if (!data || !data.query || !data.query.pages) return [];
    let pages = data.query.pages;
    let pageId = Object.keys(pages)[0];
    if (pageId === '-1' || !pages[pageId].images) return [];
    return pages[pageId].images.filter(img => isValidImage(img.title));
}

async function getWikiImage(cityName) {
    let qCity = cityName;
    if (cityName === 'Québec City') qCity = 'Québec (ville)';
    if (cityName === 'Baie-Saint-Paul') qCity = 'Baie-Saint-Paul';

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
        if (t.includes('eglise') || t.includes('église')) score -= 1;
        if (t.includes(cityName.toLowerCase())) score += 3;

        if (score > bestScore) {
            bestScore = score;
            selectedImageTitle = img.title;
        }
    }

    if (!selectedImageTitle && validImages.length > 0) {
        selectedImageTitle = validImages[0].title;
    }

    if (!selectedImageTitle) return null;

    const imgQ = encodeURIComponent(selectedImageTitle);
    const imgUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=imageinfo&titles=${imgQ}&iiprop=url&format=json`;
    let imgData = await httpsGet(imgUrl);

    if (!imgData || !imgData.query || !imgData.query.pages) return null;

    let imgPages = imgData.query.pages;
    let imgPageId = Object.keys(imgPages)[0];
    if (imgPageId === '-1' || !imgPages[imgPageId].imageinfo || imgPages[imgPageId].imageinfo.length === 0) return null;

    return imgPages[imgPageId].imageinfo[0].url;
}

async function run() {
    let citiesTs = fs.readFileSync('src/data/cities.ts', 'utf8');

    const regex = /name:\s*['"]([^'"]+)['"],\s+imageUrl:\s*'([^']+)'/g;
    let match;
    const updates = [];
    while ((match = regex.exec(citiesTs))) {
        updates.push({ name: match[1], currentImg: match[2] });
    }

    let changed = false;

    console.log(`Found ${updates.length} cities to process`);
    for (const item of updates) {
        let needsRefetch = false;
        const t = item.currentImg.toLowerCase();

        // Refetch generic unset ones OR if it has bad keywords
        if (t.includes('unsplash')) needsRefetch = true;

        const badWords = ['blason', 'logo', 'drapeau', 'flag', 'carte', 'map', 'armoiries', 'arms', 'shield', '.svg', '.png'];
        for (const word of badWords) {
            if (t.includes(word)) needsRefetch = true;
        }

        if (!needsRefetch) {
            continue;
        }

        process.stdout.write(`Working on ${item.name}... `);
        await new Promise(r => setTimeout(r, 600)); // Sleep before fetch
        let img = await getWikiImage(item.name);

        // If it failed on fr, try en
        if (!img) {
            const urlsEn = [
                `https://en.wikipedia.org/w/api.php?action=query&prop=images&titles=${encodeURIComponent(item.name)}&format=json&imlimit=100&redirects=1`,
                `https://en.wikipedia.org/w/api.php?action=query&prop=images&titles=${encodeURIComponent(item.name + ", Quebec")}&format=json&imlimit=100&redirects=1`
            ];

            for (const urlEn of urlsEn) {
                let data = await httpsGet(urlEn);
                if (data && data.query && data.query.pages) {
                    let pages = data.query.pages;
                    let pageId = Object.keys(pages)[0];
                    if (pageId !== '-1' && pages[pageId].images) {
                        let validImages = pages[pageId].images.filter(image => isValidImage(image.title));
                        if (validImages.length > 0) {
                            const imgQ = encodeURIComponent(validImages[0].title);
                            const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=imageinfo&titles=${imgQ}&iiprop=url&format=json`;
                            let imgData = await httpsGet(imgUrl);
                            if (imgData && imgData.query && imgData.query.pages) {
                                let imgPages = imgData.query.pages;
                                let imgPageId = Object.keys(imgPages)[0];
                                if (imgPageId !== '-1' && imgPages[imgPageId].imageinfo) {
                                    img = imgPages[imgPageId].imageinfo[0].url;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (!img) {
            console.log(`Fallback default`);
        } else {
            console.log(`OK -> ${img}`);
            const escName = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`(name:\\s*['"]${escName}['"],\\s+imageUrl:\\s*)'[^']+'`, 'g');
            citiesTs = citiesTs.replace(re, `$1'${img}'`);
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync('src/data/cities.ts', citiesTs);
        console.log('Saved changes.');
    } else {
        console.log('No changes needed.');
    }
}

run();
