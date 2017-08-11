const http = require('http');
const request = require('request');
const fs = require('fs');
const { JSDOM } = require('jsdom');

const baseUrl = 'duelmasters.wikia.com';
const urlsArray = [
    '/wiki/DM-01_Base_Set',
    '/wiki/DM-02_Evo-Crushinators_of_Doom'
];
let cards = {};

function get(options) {
    return promise = new Promise((resolve, reject) => {
        http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                 body += chunk;
             });
            res.on('end', (data) => {
                resolve(body);
            });
        }).on('error', (error) => {
            reject(error);
        }).end();
    });
}

get({
    host: baseUrl,
    method: 'GET',
    path: urlsArray[0]
}).then(document => {
    parseDom(document)
});

parseDom = function(documentString) {
    const dom = new JSDOM(documentString);
    let document = dom.window.document;
    let cardList = [];

    // this selecting of UL element only works on 1 page :/, now I'm just going ahead #FIXME later
    document.querySelectorAll('ul')[29].querySelectorAll('a').forEach(link => {
        cardList.push(link.title.split(' ').join('_'));
    });

    let promises = [];
    cardList.forEach(cardName => {
        let cardPromise = get({
            host: baseUrl,
            method: 'GET',
            path: '/wiki/' + cardName
        });

        promises.push(cardPromise);
    });

    Promise.all(promises).then((values) => {
        values.forEach(getCardInfo);
    }).then(saveDataOnDisc);
}

getCardInfo = function(cardPage) {
    const dom = new JSDOM(cardPage);
    let document = dom.window.document;
    let card = {};
    card.name = document.title.split('|')[0].trim();
    let cardDetailsTable = document.querySelector('table.wikitable');
    card.imgUrl = cardDetailsTable.querySelector('img').src;

    linkElements = cardDetailsTable.querySelectorAll('a');
    card.civilization = linkElements[Object.keys(linkElements).find(key => {
        return !!linkElements[key].title.match(/[A-z]* Civilization/g);
    })].title.split(' ')[0];

    card.type = getInfoFromTable(linkElements, 'Card Type').querySelector('a').title;
    if(card.type === 'Creature'){
        card.power = getInfoFromTable(linkElements, 'Power').textContent.trim();
    }

    card.manaCost = getInfoFromTable(linkElements, 'Mana Cost').textContent.trim();

    cards[card.name] = card;
};

getInfoFromTable = function(linkElements, name){
    let cardType = linkElements[Object.keys(linkElements).find(key => linkElements[key].textContent === name )];
    return cardType.parentElement.parentElement.nextSibling;
}

saveDataOnDisc = function(){
    console.log('Downloading images!');
    Object.keys(cards).forEach(key => {
        let card = cards[key];
        request.head(card.imgUrl, function(err, res, body){
            request(card.imgUrl).pipe(fs.createWriteStream('./Assets/' + card.name.split(' ').join('_') + '.jpg')).on('close', () => console.log('Done!'));
        });
    });

    fs.writeFile('./Assets/cards_data.json', JSON.stringify(cards));
}




