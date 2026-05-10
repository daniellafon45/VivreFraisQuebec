const fs = require('fs');

async function run() {
    let citiesTs = fs.readFileSync('src/data/cities.ts', 'utf8');

    // The URLs that failed or are 403
    const badUrls = [
        'https://upload.wikimedia.org/wikipedia/commons/e/ec/2007-04-18_-_98_-_Sherbrooke_-_H%C3%B4tel_de_ville.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chateau_Frontenac_and_St_Lawrence_River.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/d/d3/Montreal_Skyline.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/4/4b/Gatineau_Skyline.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/d/db/Chicoutimi-Saguenay-1.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/5/5e/Trois-Rivi%C3%A8res_-_Centre-ville_%2801%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/f/fb/Laval_Skyline.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/a/af/Longueuil_from_Mont-Royal.jpg'
    ];

    const defaultImage = "https://images.unsplash.com/photo-1542106655-eb655fbcfd5f?q=80&w=800&auto=format&fit=crop";

    let changed = false;
    for (const badUrl of badUrls) {
        if (citiesTs.includes(badUrl)) {
            citiesTs = citiesTs.replace(badUrl, defaultImage);
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync('src/data/cities.ts', citiesTs);
        console.log('Cleared bad URLs.');
    } else {
        console.log('No bad URLs found, already cleared?');
    }
}

run();
