function getRandomIndexUpto( num ) {
    return Math.floor( Math.random() * num );
}

function randomSizeStringWithCustomPossibles( len, possibles ) {
    const possiblesLength = possibles.length;
    let str = '';
    for( let i=0; i<len; i++){
        str = str + possibles.charAt( getRandomIndexUpto(possiblesLength) );
    }
    return str;
}

function randomString( len ){
    const possibles = 'qwertyuiopasdfghjklzxcvbnm';
    return randomSizeStringWithCustomPossibles( len, possibles );
}

function randomID( len = 16 ){
    const possibles = '567890qwertyuiopasdfghjklzxcvbnm12345';
    return randomSizeStringWithCustomPossibles( len, possibles );
}

function randomBtwn(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

function sleep( ms ){
    return new Promise( resolve => setTimeout( resolve, ms) );
}

function calculateSlotFromString(slotString) {
    const slot = [];
    
    const split = slotString.split('-');
    for(let i=0; i<split.length; i++){
        slot.push( parseInt( split[i] ) );
    }

    if( slot.length >= 2 ) {
        return randomBtwn(slot[0], slot[1]) * 1000;
    }
    return randomBtwn(30, 45) * 1000;
}

async function executeAfter(ms, callback){
    await sleep(ms);
    return callback();
}

module.exports = {
    randomString,
    randomID,
    randomBtwn,
    sleep,
    calculateSlotFromString,
    executeAfter
};